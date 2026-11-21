/**
 * Ingestion pipeline: fetch → validate/normalize → sync to Postgres.
 *
 * Design notes
 * - Idempotent: safe to run repeatedly (upserts keyed by natural slugs).
 * - Diff-based offerings sync: ~9k listings are compared in memory and only
 *   new/changed rows are written, so a daily re-run touches very few rows.
 * - Price history: a PriceSnapshot row is written only when a price changes.
 * - Every run is recorded in `ingestion_runs` for auditing / freshness UI.
 */
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { BENCHMARKS, extractBenchmarkScores } from "./benchmarks";
import { normalizeModelsDev, type NormalizedOffering } from "./normalize";

export const MODELS_DEV_URL = "https://models.dev/api.json";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

type Logger = (msg: string) => void;

export interface IngestionResult {
  runId: string;
  durationMs: number;
  stats: Record<string, unknown>;
}

async function fetchJson(url: string, timeoutMs = 30_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "OneAtlas-Ingest/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Run `fn` over `items` with at most `limit` promises in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const OFFERING_FIELDS = [
  "inputPrice",
  "outputPrice",
  "cacheReadPrice",
  "cacheWritePrice",
  "contextWindow",
  "maxOutputTokens",
  "deprecated",
] as const;

export async function runIngestion({
  trigger,
  log = () => {},
}: {
  trigger: string;
  log?: Logger;
}): Promise<IngestionResult> {
  const started = Date.now();
  const run = await db.ingestionRun.create({ data: { trigger } });
  const warnings: string[] = [];

  try {
    log("Fetching sources…");
    const [modelsDevRaw, openRouterRaw] = await Promise.all([
      fetchJson(MODELS_DEV_URL),
      // Benchmarks are optional: a failure here shouldn't block catalog updates.
      fetchJson(OPENROUTER_URL).catch((err: Error) => {
        warnings.push(`OpenRouter benchmarks unavailable: ${err.message}`);
        return null;
      }),
    ]);

    log("Normalizing…");
    const catalog = normalizeModelsDev(modelsDevRaw);
    log(
      `  ${catalog.models.length} models, ${catalog.offerings.length} offerings, ` +
        `${catalog.providers.length} providers, ${catalog.labs.length} labs`,
    );

    // ---- Labs -------------------------------------------------------------
    log("Syncing labs…");
    await mapLimit(catalog.labs, 10, (lab) =>
      db.lab.upsert({
        where: { slug: lab.slug },
        create: lab,
        update: { name: lab.name, website: lab.website, country: lab.country },
      }),
    );
    const labIds = new Map(
      (await db.lab.findMany({ select: { id: true, slug: true } })).map((l) => [l.slug, l.id]),
    );

    // ---- Providers --------------------------------------------------------
    log("Syncing providers…");
    await mapLimit(catalog.providers, 10, (p) =>
      db.provider.upsert({ where: { slug: p.slug }, create: p, update: p }),
    );
    const providerIds = new Map(
      (await db.provider.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]),
    );

    // ---- Models -----------------------------------------------------------
    log("Syncing models…");
    await mapLimit(catalog.models, 10, ({ labSlug, ...m }) => {
      const data = { ...m, labId: labIds.get(labSlug)! };
      return db.model.upsert({ where: { slug: m.slug }, create: data, update: data });
    });
    const modelIds = new Map(
      (await db.model.findMany({ select: { id: true, slug: true } })).map((m) => [m.slug, m.id]),
    );

    // ---- Offerings (diff) -------------------------------------------------
    log("Syncing offerings…");
    const offeringStats = await syncOfferings(catalog.offerings, modelIds, providerIds);

    // ---- Benchmarks -------------------------------------------------------
    let benchmarkStats: Record<string, number> = { scores: 0 };
    if (openRouterRaw) {
      log("Syncing benchmarks…");
      benchmarkStats = await syncBenchmarks(openRouterRaw, modelIds);
    }

    // ---- Denormalized aggregates -----------------------------------------
    log("Recomputing model aggregates…");
    await recomputeModelAggregates();

    const stats = {
      ...catalog.stats,
      models: catalog.models.length,
      labs: catalog.labs.length,
      providers: catalog.providers.length,
      offerings: offeringStats,
      benchmarks: benchmarkStats,
      issues: catalog.issues,
      warnings,
    };
    await db.ingestionRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), stats },
    });
    const durationMs = Date.now() - started;
    log(`Done in ${(durationMs / 1000).toFixed(1)}s`);
    return { runId: run.id, durationMs, stats };
  } catch (err) {
    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

async function syncOfferings(
  offerings: NormalizedOffering[],
  modelIds: Map<string, string>,
  providerIds: Map<string, string>,
) {
  const existing = await db.offering.findMany();
  const byKey = new Map(existing.map((o) => [`${o.providerId}::${o.providerModelId}`, o]));
  const seen = new Set<string>();

  const toCreate: Prisma.OfferingCreateManyInput[] = [];
  const toUpdate: { id: string; data: Prisma.OfferingUpdateInput; priceChanged: boolean }[] = [];

  for (const o of offerings) {
    const modelId = modelIds.get(o.modelSlug);
    const providerId = providerIds.get(o.providerSlug);
    if (!modelId || !providerId) continue;
    const key = `${providerId}::${o.providerModelId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const row = {
      modelId,
      providerId,
      providerModelId: o.providerModelId,
      inputPrice: o.inputPrice,
      outputPrice: o.outputPrice,
      cacheReadPrice: o.cacheReadPrice,
      cacheWritePrice: o.cacheWritePrice,
      contextWindow: o.contextWindow,
      maxOutputTokens: o.maxOutputTokens,
      deprecated: o.deprecated,
    };
    const prev = byKey.get(key);
    if (!prev) {
      toCreate.push(row);
      continue;
    }
    const changed =
      prev.modelId !== modelId || OFFERING_FIELDS.some((f) => prev[f] !== row[f]);
    if (changed) {
      toUpdate.push({
        id: prev.id,
        data: row,
        priceChanged: prev.inputPrice !== row.inputPrice || prev.outputPrice !== row.outputPrice,
      });
    }
  }

  const staleIds = existing
    .filter((o) => !seen.has(`${o.providerId}::${o.providerModelId}`))
    .map((o) => o.id);

  const snapshots: Prisma.PriceSnapshotCreateManyInput[] = [];

  for (const batch of chunk(toCreate, 1000)) {
    const created = await db.offering.createManyAndReturn({
      data: batch,
      select: { id: true, inputPrice: true, outputPrice: true },
    });
    for (const c of created) {
      snapshots.push({ offeringId: c.id, inputPrice: c.inputPrice, outputPrice: c.outputPrice });
    }
  }

  await mapLimit(toUpdate, 10, (u) => db.offering.update({ where: { id: u.id }, data: u.data }));
  for (const u of toUpdate) {
    if (u.priceChanged) {
      const d = u.data as { inputPrice: number | null; outputPrice: number | null };
      snapshots.push({ offeringId: u.id, inputPrice: d.inputPrice, outputPrice: d.outputPrice });
    }
  }

  for (const batch of chunk(snapshots, 2000)) {
    await db.priceSnapshot.createMany({ data: batch });
  }
  for (const batch of chunk(staleIds, 1000)) {
    await db.offering.deleteMany({ where: { id: { in: batch } } });
  }

  return {
    created: toCreate.length,
    updated: toUpdate.length,
    removed: staleIds.length,
    priceChanges: toUpdate.filter((u) => u.priceChanged).length,
  };
}

async function syncBenchmarks(raw: unknown, modelIds: Map<string, string>) {
  await mapLimit(BENCHMARKS, 5, (b) => {
    // Persist only the descriptive fields; `extract` is code, not data.
    const def = {
      slug: b.slug,
      name: b.name,
      category: b.category,
      description: b.description,
      source: b.source,
      sourceUrl: b.sourceUrl,
      unit: b.unit,
      sortOrder: b.sortOrder,
    };
    return db.benchmark.upsert({ where: { slug: def.slug }, create: def, update: def });
  });
  const benchmarkIds = new Map(
    (await db.benchmark.findMany({ select: { id: true, slug: true } })).map((b) => [b.slug, b.id]),
  );

  const extraction = extractBenchmarkScores(raw, modelIds.keys());
  const rows: Prisma.BenchmarkScoreCreateManyInput[] = extraction.scores.map((s) => ({
    modelId: modelIds.get(s.modelSlug)!,
    benchmarkId: benchmarkIds.get(s.benchmarkSlug)!,
    score: s.score,
  }));

  // Scores are a point-in-time leaderboard: replace atomically.
  await db.$transaction([
    db.benchmarkScore.deleteMany({}),
    db.benchmarkScore.createMany({ data: rows }),
  ]);

  return {
    scores: rows.length,
    matchedModels: extraction.matchedModels,
    unmatchedModels: extraction.unmatchedModels,
  };
}

/**
 * One SQL statement refreshes the listing-page columns for every model.
 *
 * A listing's price is "trusted" when it is pay-as-you-go: not a subscription
 * plan, not deprecated, and either non-zero or from a provider with a real
 * free tier. This stops "$0 because it's bundled" listings from making a
 * frontier model look free.
 */
export async function recomputeModelAggregates() {
  await db.$executeRaw`
    UPDATE "models" AS m SET
      "inputPrice"        = COALESCE(agg.official_in, agg.median_in),
      "outputPrice"       = COALESCE(agg.official_out, agg.median_out),
      "priceIsOfficial"   = agg.official_in IS NOT NULL,
      "minInputPrice"     = agg.min_in,
      "minOutputPrice"    = agg.min_out,
      "isFree"            = agg.is_free,
      "providerCount"     = agg.provider_count,
      "intelligenceScore" = agg.intelligence
    FROM (
      SELECT
        mm.id,
        -- "Official" = sold by the lab itself (provider slug == lab slug).
        MIN(o."inputPrice")  FILTER (WHERE t.trusted AND p.slug = l.slug) AS official_in,
        MIN(o."outputPrice") FILTER (WHERE t.trusted AND p.slug = l.slug) AS official_out,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY o."inputPrice")
          FILTER (WHERE t.trusted)                                        AS median_in,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY o."outputPrice")
          FILTER (WHERE t.trusted)                                        AS median_out,
        MIN(o."inputPrice")  FILTER (WHERE t.trusted) AS min_in,
        MIN(o."outputPrice") FILTER (WHERE t.trusted) AS min_out,
        COALESCE(BOOL_OR(o."inputPrice" = 0 AND o."outputPrice" = 0)
          FILTER (WHERE t.trusted), false)            AS is_free,
        COUNT(DISTINCT o."providerId") FILTER (WHERE NOT o.deprecated)                 AS provider_count,
        (SELECT bs.score FROM "benchmark_scores" bs
           JOIN "benchmarks" b ON b.id = bs."benchmarkId"
          WHERE b.slug = 'aa-intelligence' AND bs."modelId" = mm.id)                   AS intelligence
      FROM "models" mm
      JOIN "labs" l ON l.id = mm."labId"
      LEFT JOIN "offerings" o ON o."modelId" = mm.id
      LEFT JOIN "providers" p ON p.id = o."providerId"
      LEFT JOIN LATERAL (
        SELECT (NOT p."isSubscription" AND NOT o.deprecated
                AND (COALESCE(o."inputPrice", 0) > 0
                     OR COALESCE(o."outputPrice", 0) > 0
                     OR p."hasFreeTier")) AS trusted
      ) t ON true
      GROUP BY mm.id
    ) AS agg
    WHERE agg.id = m.id`;
}
