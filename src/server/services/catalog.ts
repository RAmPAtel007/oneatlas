import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";
import { blendedPrice } from "@/lib/format";
import { paretoFrontier } from "@/lib/pareto";
import type { LeaderboardQuery } from "@/lib/query-schemas";
import { modelListSelect } from "./models";

/* ------------------------------------------------------------------------ */
/* Labs                                                                      */
/* ------------------------------------------------------------------------ */

export async function listLabs() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const [labs, agg] = await Promise.all([
    db.lab.findMany({ orderBy: { name: "asc" } }),
    db.model.groupBy({
      by: ["labId"],
      where: { status: { not: "DEPRECATED" } },
      _count: { _all: true },
      _max: { releaseDate: true, intelligenceScore: true },
    }),
  ]);
  const openWeights = await db.model.groupBy({
    by: ["labId"],
    where: { status: { not: "DEPRECATED" }, openWeights: true },
    _count: { _all: true },
  });
  const aggByLab = new Map(agg.map((a) => [a.labId, a]));
  const openByLab = new Map(openWeights.map((a) => [a.labId, a._count._all]));

  return labs
    .map((lab) => {
      const a = aggByLab.get(lab.id);
      return {
        ...lab,
        modelCount: a?._count._all ?? 0,
        openWeightsCount: openByLab.get(lab.id) ?? 0,
        latestRelease: a?._max.releaseDate ?? null,
        topIntelligence: a?._max.intelligenceScore ?? null,
      };
    })
    .filter((l) => l.modelCount > 0)
    .sort((a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));
}

export type LabSummary = Awaited<ReturnType<typeof listLabs>>[number];

export async function getLab(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const lab = await db.lab.findUnique({
    where: { slug },
    include: {
      models: {
        orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { name: "asc" }],
        select: modelListSelect,
      },
    },
  });
  if (!lab) return null;

  // Which providers carry this lab's models, and how many each.
  const providers = await db.$queryRaw<{ slug: string; name: string; count: bigint }[]>`
    SELECT p.slug, p.name, COUNT(DISTINCT o."modelId") AS count
    FROM "offerings" o
    JOIN "models" m    ON m.id = o."modelId"
    JOIN "providers" p ON p.id = o."providerId"
    WHERE m."labId" = ${lab.id} AND NOT o.deprecated
    GROUP BY p.id ORDER BY count DESC, p.name ASC
    LIMIT 12`;

  return {
    ...lab,
    topProviders: providers.map((p) => ({ ...p, count: Number(p.count) })),
  };
}

/* ------------------------------------------------------------------------ */
/* Providers                                                                 */
/* ------------------------------------------------------------------------ */

export async function listProviders() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const rows = await db.$queryRaw<
    {
      slug: string;
      name: string;
      docsUrl: string | null;
      isSubscription: boolean;
      hasFreeTier: boolean;
      models: bigint;
      labs: bigint;
      minInput: number | null;
    }[]
  >`
    SELECT p.slug, p.name, p."docsUrl", p."isSubscription", p."hasFreeTier",
           COUNT(DISTINCT o."modelId")  AS models,
           COUNT(DISTINCT m."labId")    AS labs,
           MIN(o."inputPrice") FILTER (WHERE o."inputPrice" > 0) AS "minInput"
    FROM "providers" p
    JOIN "offerings" o ON o."providerId" = p.id AND NOT o.deprecated
    JOIN "models" m    ON m.id = o."modelId"
    GROUP BY p.id
    ORDER BY models DESC, p.name ASC`;

  return rows.map((r) => ({ ...r, models: Number(r.models), labs: Number(r.labs) }));
}

export type ProviderSummary = Awaited<ReturnType<typeof listProviders>>[number];

export async function getProvider(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  return db.provider.findUnique({
    where: { slug },
    include: {
      offerings: {
        where: { deprecated: false },
        include: {
          model: {
            select: {
              slug: true,
              name: true,
              type: true,
              contextWindow: true,
              releaseDate: true,
              intelligenceScore: true,
              inputPrice: true,
              lab: { select: { slug: true, name: true } },
            },
          },
        },
        orderBy: { model: { releaseDate: { sort: "desc", nulls: "last" } } },
      },
    },
  });
}

/* ------------------------------------------------------------------------ */
/* Benchmarks & rankings                                                     */
/* ------------------------------------------------------------------------ */

export async function listBenchmarks() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const benchmarks = await db.benchmark.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { scores: true } } },
  });
  return benchmarks.map(({ _count, ...b }) => ({ ...b, modelCount: _count.scores }));
}

export type BenchmarkSummary = Awaited<ReturnType<typeof listBenchmarks>>[number];

export async function getLeaderboard(slug: string, query: LeaderboardQuery) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const benchmark = await db.benchmark.findUnique({ where: { slug } });
  if (!benchmark) return null;

  const scores = await db.benchmarkScore.findMany({
    where: {
      benchmarkId: benchmark.id,
      ...(query.openWeights ? { model: { openWeights: true } } : {}),
    },
    orderBy: { score: benchmark.higherIsBetter ? "desc" : "asc" },
    take: query.limit,
    include: { model: { select: modelListSelect } },
  });

  // Standard competition ranking: ties share a rank (1, 2, 2, 4).
  let prevScore: number | null = null;
  let prevRank = 0;
  const rows = scores.map((s, i) => {
    const rank = s.score === prevScore ? prevRank : i + 1;
    prevScore = s.score;
    prevRank = rank;
    return { rank, score: s.score, model: s.model };
  });

  return { benchmark, rows };
}

export type Leaderboard = NonNullable<Awaited<ReturnType<typeof getLeaderboard>>>;

/** Data for the price-vs-intelligence chart, with the Pareto frontier marked. */
export async function getValueLandscape() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const models = await db.model.findMany({
    where: {
      type: "TEXT",
      status: { not: "DEPRECATED" },
      intelligenceScore: { not: null },
      inputPrice: { not: null, gt: 0 },
      outputPrice: { not: null },
    },
    select: {
      slug: true,
      name: true,
      intelligenceScore: true,
      inputPrice: true,
      outputPrice: true,
      openWeights: true,
      lab: { select: { name: true, slug: true } },
    },
  });

  const points = models.map((m) => ({
    slug: m.slug,
    name: m.name,
    lab: m.lab.name,
    labSlug: m.lab.slug,
    openWeights: m.openWeights,
    score: m.intelligenceScore!,
    price: blendedPrice(m.inputPrice, m.outputPrice)!,
  }));
  const frontier = new Set(paretoFrontier(points).map((p) => p.slug));
  return points.map((p) => ({ ...p, onFrontier: frontier.has(p.slug) }));
}

export type ValuePointData = Awaited<ReturnType<typeof getValueLandscape>>[number];

/* ------------------------------------------------------------------------ */
/* Global search                                                             */
/* ------------------------------------------------------------------------ */

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function globalSearch(q: string, limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const like = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;

  // Matching: substring (ILIKE, trigram-indexed) OR fuzzy word match.
  // word_similarity() compares the query to the best-matching *word* in the
  // name, so "gemni" scores 0.5 against "Gemini 2.5 Flash" (whole-string
  // similarity would only be ~0.13). 0.4 catches one-letter typos without
  // flooding results. Values are bound parameters — no SQL injection.
  //
  // Trigrams are weak on swapped letters ("cluade"), so we also compare the
  // first word of the query with the first word of each name by edit
  // distance (levenshtein): 1 typo allowed for 4–5 letters, 2 for 6+.
  const FUZZY = 0.4;
  const word = q.toLowerCase().split(/\s+/)[0].slice(0, 50);
  const maxEdits = word.length >= 6 ? 2 : word.length >= 4 ? 1 : 0;
  const [models, labs, providers] = await Promise.all([
    db.$queryRaw<{ slug: string; name: string; lab: string; type: string }[]>`
      SELECT m.slug, m.name, l.name AS lab, m.type::text AS type
      FROM "models" m JOIN "labs" l ON l.id = m."labId"
      WHERE m.name ILIKE ${like} OR m.slug ILIKE ${like}
         OR word_similarity(${q}, m.name) >= ${FUZZY}
         OR levenshtein(${word}, split_part(lower(m.name), ' ', 1)) <= ${maxEdits}
      ORDER BY (m.name ILIKE ${prefix}) DESC,
               (m.name ILIKE ${like} OR m.slug ILIKE ${like}) DESC,
               (m.status = 'DEPRECATED') ASC,
               word_similarity(${q}, m.name) DESC,
               levenshtein(${word}, split_part(lower(m.name), ' ', 1)) ASC,
               m."providerCount" DESC
      LIMIT ${limit}`,
    db.$queryRaw<{ slug: string; name: string }[]>`
      SELECT slug, name FROM "labs"
      WHERE name ILIKE ${like} OR slug ILIKE ${like} OR word_similarity(${q}, name) >= ${FUZZY}
         OR levenshtein(${word}, split_part(lower(name), ' ', 1)) <= ${maxEdits}
      ORDER BY (name ILIKE ${prefix}) DESC,
               levenshtein(${word}, split_part(lower(name), ' ', 1)) ASC,
               word_similarity(${q}, name) DESC
      LIMIT 4`,
    db.$queryRaw<{ slug: string; name: string }[]>`
      SELECT slug, name FROM "providers"
      WHERE name ILIKE ${like} OR slug ILIKE ${like} OR word_similarity(${q}, name) >= ${FUZZY}
         OR levenshtein(${word}, split_part(lower(name), ' ', 1)) <= ${maxEdits}
      ORDER BY (name ILIKE ${prefix}) DESC,
               levenshtein(${word}, split_part(lower(name), ' ', 1)) ASC,
               word_similarity(${q}, name) DESC
      LIMIT 4`,
  ]);

  return { models, labs, providers };
}

export type SearchResults = Awaited<ReturnType<typeof globalSearch>>;

/* ------------------------------------------------------------------------ */
/* Stats                                                                     */
/* ------------------------------------------------------------------------ */

export async function getCatalogStats() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const active = { status: { not: "DEPRECATED" as const } };
  const textActive = { ...active, type: "TEXT" as const };
  const [models, labs, providers, offerings, scores, text, reasoning, tools, vision, open, lastRun] =
    await Promise.all([
      db.model.count({ where: active }),
      db.lab.count(),
      db.provider.count(),
      db.offering.count({ where: { deprecated: false } }),
      db.benchmarkScore.count(),
      db.model.count({ where: textActive }),
      db.model.count({ where: { ...textActive, reasoning: true } }),
      db.model.count({ where: { ...textActive, toolCalling: true } }),
      db.model.count({ where: { ...textActive, inputModalities: { has: "IMAGE" } } }),
      db.model.count({ where: { ...textActive, openWeights: true } }),
      db.ingestionRun.findFirst({
        where: { status: "SUCCESS" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    ]);

  const pct = (n: number) => (text ? Math.round((n / text) * 100) : 0);
  return {
    models,
    labs,
    providers,
    offerings,
    benchmarkScores: scores,
    lastSyncedAt: lastRun?.finishedAt ?? null,
    coverage: {
      reasoning: pct(reasoning),
      toolCalling: pct(tools),
      vision: pct(vision),
      openWeights: pct(open),
    },
  };
}

export async function getRecentModels(limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  return db.model.findMany({
    where: { status: { not: "DEPRECATED" }, releaseDate: { not: null } },
    orderBy: [{ releaseDate: "desc" }, { providerCount: "desc" }],
    take: limit,
    select: modelListSelect,
  });
}
