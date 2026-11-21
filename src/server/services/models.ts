import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { ModelType } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import {
  DEFAULT_ORDER,
  type CapabilityParam,
  type ModelListQuery,
} from "@/lib/query-schemas";

/**
 * Model queries. Every exported function is wrapped in `'use cache'`: the
 * arguments form the cache key, results are tagged "catalog" so the nightly
 * ingestion can invalidate them in one call.
 */

export const modelListSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  status: true,
  inputModalities: true,
  outputModalities: true,
  reasoning: true,
  toolCalling: true,
  structuredOutput: true,
  openWeights: true,
  contextWindow: true,
  maxOutputTokens: true,
  releaseDate: true,
  inputPrice: true,
  outputPrice: true,
  priceIsOfficial: true,
  minInputPrice: true,
  isFree: true,
  providerCount: true,
  intelligenceScore: true,
  lab: { select: { slug: true, name: true } },
} satisfies Prisma.ModelSelect;

export type ModelListItem = Prisma.ModelGetPayload<{ select: typeof modelListSelect }>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const CAPABILITY_FILTERS: Record<CapabilityParam, Prisma.ModelWhereInput> = {
  reasoning: { reasoning: true },
  tools: { toolCalling: true },
  "structured-output": { structuredOutput: true },
  vision: { inputModalities: { has: "IMAGE" } },
  "audio-input": { inputModalities: { has: "AUDIO" } },
  "open-weights": { openWeights: true },
  free: { isFree: true },
};

export function buildModelWhere(q: ModelListQuery): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = [];

  if (q.q) {
    // Every word must match somewhere: "claude opus" → name/slug/lab/family.
    for (const term of q.q.split(/\s+/).slice(0, 6)) {
      const contains = { contains: term, mode: "insensitive" as const };
      and.push({
        OR: [
          { name: contains },
          { slug: contains },
          { family: contains },
          { lab: { name: contains } },
        ],
      });
    }
  }
  if (q.lab?.length) and.push({ lab: { slug: { in: q.lab } } });
  if (q.provider?.length) {
    and.push({
      offerings: { some: { deprecated: false, provider: { slug: { in: q.provider } } } },
    });
  }
  if (q.type?.length) {
    and.push({ type: { in: q.type.map((t) => t.toUpperCase() as ModelType) } });
  }
  for (const cap of q.cap ?? []) and.push(CAPABILITY_FILTERS[cap]);
  if (q.minContext) and.push({ contextWindow: { gte: q.minContext } });
  if (q.maxPrice !== undefined) and.push({ inputPrice: { lte: q.maxPrice } });
  if (!q.deprecated) and.push({ status: { not: "DEPRECATED" } });

  return and.length ? { AND: and } : {};
}

export function buildModelOrderBy(q: ModelListQuery): Prisma.ModelOrderByWithRelationInput[] {
  const dir = q.order ?? DEFAULT_ORDER[q.sort];
  const nullsLast = (sort: "asc" | "desc") => ({ sort, nulls: "last" as const });
  const primary: Prisma.ModelOrderByWithRelationInput = (() => {
    switch (q.sort) {
      case "name":
        return { name: dir };
      case "price":
        return { inputPrice: nullsLast(dir) };
      case "context":
        return { contextWindow: nullsLast(dir) };
      case "intelligence":
        return { intelligenceScore: nullsLast(dir) };
      case "popularity":
        return { providerCount: dir };
      case "newest":
      default:
        return { releaseDate: nullsLast(dir) };
    }
  })();
  // Tie-breakers keep pagination stable across pages.
  return [primary, { providerCount: "desc" }, { id: "asc" }];
}

export async function listModels(query: ModelListQuery): Promise<Paginated<ModelListItem>> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const where = buildModelWhere(query);
  const [items, total] = await Promise.all([
    db.model.findMany({
      where,
      orderBy: buildModelOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: modelListSelect,
    }),
    db.model.count({ where }),
  ]);

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getModelDetail(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const model = await db.model.findUnique({
    where: { slug },
    include: {
      lab: true,
      offerings: {
        include: {
          provider: {
            select: { slug: true, name: true, isSubscription: true, hasFreeTier: true, docsUrl: true },
          },
          snapshots: { orderBy: { capturedAt: "asc" }, select: { inputPrice: true, outputPrice: true, capturedAt: true } },
        },
        orderBy: [{ inputPrice: { sort: "asc", nulls: "last" } }, { outputPrice: { sort: "asc", nulls: "last" } }],
      },
      scores: {
        include: { benchmark: true },
        orderBy: { benchmark: { sortOrder: "asc" } },
      },
    },
  });
  if (!model) return null;

  // Rank this model within each benchmark it appears in (window function).
  const ranks = await db.$queryRaw<{ benchmarkId: string; rank: bigint; total: bigint }[]>`
    SELECT "benchmarkId", rank, total FROM (
      SELECT "benchmarkId", "modelId",
             RANK()   OVER (PARTITION BY "benchmarkId" ORDER BY score DESC) AS rank,
             COUNT(*) OVER (PARTITION BY "benchmarkId")                     AS total
      FROM "benchmark_scores"
    ) ranked
    WHERE "modelId" = ${model.id}`;
  const rankByBenchmark = new Map(
    ranks.map((r) => [r.benchmarkId, { rank: Number(r.rank), total: Number(r.total) }]),
  );

  return {
    ...model,
    scores: model.scores.map((s) => ({
      ...s,
      rank: rankByBenchmark.get(s.benchmarkId)?.rank ?? null,
      total: rankByBenchmark.get(s.benchmarkId)?.total ?? null,
    })),
  };
}

export type ModelDetail = NonNullable<Awaited<ReturnType<typeof getModelDetail>>>;

/** "More from this lab" + "cheaper models with similar intelligence". */
export async function getRelatedModels(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const model = await db.model.findUnique({
    where: { slug },
    select: { id: true, labId: true, type: true, intelligenceScore: true, inputPrice: true },
  });
  if (!model) return { fromLab: [], cheaperAlternatives: [] };

  const [fromLab, cheaperAlternatives] = await Promise.all([
    db.model.findMany({
      where: { labId: model.labId, id: { not: model.id }, status: { not: "DEPRECATED" } },
      orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }],
      take: 6,
      select: modelListSelect,
    }),
    model.intelligenceScore != null && model.inputPrice != null && model.inputPrice > 0
      ? db.model.findMany({
          where: {
            id: { not: model.id },
            type: model.type,
            status: { not: "DEPRECATED" },
            intelligenceScore: { gte: model.intelligenceScore - 5 },
            inputPrice: { lt: model.inputPrice },
          },
          orderBy: [{ intelligenceScore: "desc" }],
          take: 4,
          select: modelListSelect,
        })
      : Promise.resolve([]),
  ]);

  return { fromLab, cheaperAlternatives };
}

export async function getModelsForCompare(slugs: string[]) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const models = await db.model.findMany({
    where: { slug: { in: slugs } },
    select: {
      ...modelListSelect,
      description: true,
      temperature: true,
      attachments: true,
      knowledgeCutoff: true,
      minOutputPrice: true,
      scores: { select: { score: true, benchmark: { select: { slug: true, name: true, unit: true, category: true, sortOrder: true } } } },
    },
  });
  // Preserve the order the user picked.
  const bySlug = new Map(models.map((m) => [m.slug, m]));
  return slugs.map((s) => bySlug.get(s)).filter((m): m is NonNullable<typeof m> => Boolean(m));
}

export type CompareModel = Awaited<ReturnType<typeof getModelsForCompare>>[number];

/** Options + counts for the filter sidebar. */
export async function getFilterOptions() {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const active = { status: { not: "DEPRECATED" as const } };
  const [labs, providers, types] = await Promise.all([
    db.lab.findMany({
      select: { slug: true, name: true, _count: { select: { models: { where: active } } } },
    }),
    db.$queryRaw<{ slug: string; name: string; count: bigint }[]>`
      SELECT p.slug, p.name, COUNT(DISTINCT o."modelId") AS count
      FROM "providers" p JOIN "offerings" o ON o."providerId" = p.id
      WHERE NOT o.deprecated
      GROUP BY p.id ORDER BY count DESC, p.name ASC`,
    db.model.groupBy({ by: ["type"], where: active, _count: { _all: true } }),
  ]);

  return {
    labs: labs
      .map((l) => ({ slug: l.slug, name: l.name, count: l._count.models }))
      .filter((l) => l.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    providers: providers.map((p) => ({ slug: p.slug, name: p.name, count: Number(p.count) })),
    types: types
      .map((t) => ({ type: t.type, count: t._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

export type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;
