/**
 * Input contracts shared by the REST API and the server-rendered pages.
 * One Zod schema per endpoint means the UI and API can never disagree about
 * what a valid filter is.
 */
import { z } from "zod";

export const MODEL_TYPE_PARAMS = [
  "text",
  "image",
  "video",
  "speech",
  "transcription",
  "embedding",
  "reranking",
  "realtime",
] as const;
export type ModelTypeParam = (typeof MODEL_TYPE_PARAMS)[number];

export const CAPABILITY_PARAMS = [
  "reasoning",
  "tools",
  "structured-output",
  "vision",
  "audio-input",
  "open-weights",
  "free",
] as const;
export type CapabilityParam = (typeof CAPABILITY_PARAMS)[number];

export const SORT_PARAMS = [
  "newest",
  "name",
  "price",
  "context",
  "intelligence",
  "popularity",
] as const;
export type SortParam = (typeof SORT_PARAMS)[number];

/** Default direction per sort, e.g. price → cheapest first. */
export const DEFAULT_ORDER: Record<SortParam, "asc" | "desc"> = {
  newest: "desc",
  name: "asc",
  price: "asc",
  context: "desc",
  intelligence: "desc",
  popularity: "desc",
};

const slug = z
  .string()
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Invalid slug");

/** Accepts `a,b,c` (or repeated params, already joined) → string[]. */
function csv<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return undefined;
    const parts = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }, z.array(item).max(50).optional());
}

export const modelListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  lab: csv(slug),
  provider: csv(slug),
  type: csv(z.enum(MODEL_TYPE_PARAMS)),
  cap: csv(z.enum(CAPABILITY_PARAMS)),
  minContext: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(100_000).optional(),
  deprecated: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  sort: z.enum(SORT_PARAMS).default("newest"),
  order: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type ModelListQuery = z.output<typeof modelListQuerySchema>;

export const compareQuerySchema = z.object({
  models: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.string().min(3).max(200)).min(1).max(4),
  ),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  openWeights: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type LeaderboardQuery = z.output<typeof leaderboardQuerySchema>;

/**
 * Turn URLSearchParams or Next.js `searchParams` into a flat string record.
 * Repeated keys are joined with commas; empty values are dropped so that
 * `?page=` falls back to the default instead of failing validation.
 */
export function toParamRecord(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (key: string, value: string) => {
    if (!value.trim()) return;
    out[key] = out[key] ? `${out[key]},${value}` : value;
  };
  if (input instanceof URLSearchParams) {
    input.forEach((value, key) => add(key, value));
  } else {
    for (const [key, value] of Object.entries(input)) {
      if (Array.isArray(value)) value.forEach((v) => add(key, v));
      else if (value !== undefined) add(key, value);
    }
  }
  return out;
}

/** Lenient parse for pages: invalid params fall back to defaults instead of erroring. */
export function parseModelListQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): ModelListQuery {
  const record = toParamRecord(input);
  const parsed = modelListQuerySchema.safeParse(record);
  if (parsed.success) return parsed.data;
  // Drop only the offending keys and retry, so one bad param doesn't wipe the rest.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  const cleaned = Object.fromEntries(Object.entries(record).filter(([k]) => !bad.has(k)));
  return modelListQuerySchema.parse(cleaned);
}

/**
 * Inverse of parseModelListQuery: build a /models URL from a query plus
 * overrides, omitting defaults so links stay short and shareable.
 */
export function modelsHref(
  query: Partial<ModelListQuery>,
  overrides: Partial<ModelListQuery> & { view?: string } = {},
): string {
  const merged = { ...query, ...overrides } as Partial<ModelListQuery> & { view?: string };
  const params = new URLSearchParams();
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      return;
    }
    params.set(key, String(value));
  };
  set("q", merged.q);
  set("lab", merged.lab);
  set("provider", merged.provider);
  set("type", merged.type);
  set("cap", merged.cap);
  set("minContext", merged.minContext);
  set("maxPrice", merged.maxPrice);
  set("deprecated", merged.deprecated ? "true" : undefined);
  if (merged.sort && merged.sort !== "newest") set("sort", merged.sort);
  if (merged.order && merged.order !== DEFAULT_ORDER[merged.sort ?? "newest"]) set("order", merged.order);
  if (merged.page && merged.page > 1) set("page", merged.page);
  if (merged.pageSize && merged.pageSize !== 30) set("pageSize", merged.pageSize);
  set("view", merged.view === "grid" ? "grid" : undefined);
  const qs = params.toString();
  return qs ? `/models?${qs}` : "/models";
}
