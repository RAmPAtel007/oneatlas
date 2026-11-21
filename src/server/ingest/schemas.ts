import { z } from "zod";

/**
 * Runtime validation for the external data sources.
 *
 * We never trust third-party JSON: every record is parsed individually with
 * `safeParse`, so one malformed model is skipped (and counted) instead of
 * failing the whole sync.
 */

const price = z.number().finite().nonnegative().nullish();
const tokens = z.number().finite().nonnegative().nullish();

// ---- models.dev (https://models.dev/api.json) -----------------------------

export const modelsDevModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  family: z.string().nullish(),
  canonical_model_id: z.string().nullish(),
  type: z.string().nullish(),
  status: z.string().nullish(),
  attachment: z.boolean().nullish(),
  reasoning: z.boolean().nullish(),
  tool_call: z.boolean().nullish(),
  structured_output: z.boolean().nullish(),
  temperature: z.boolean().nullish(),
  open_weights: z.boolean().nullish(),
  knowledge: z.string().nullish(),
  release_date: z.string().nullish(),
  last_updated: z.string().nullish(),
  modalities: z
    .object({
      input: z.array(z.string()).nullish(),
      output: z.array(z.string()).nullish(),
    })
    .nullish(),
  limit: z
    .object({ context: tokens, input: tokens, output: tokens })
    .nullish(),
  cost: z
    .object({
      input: price,
      output: price,
      cache_read: price,
      cache_write: price,
    })
    .nullish(),
});

export const modelsDevProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  doc: z.string().nullish(),
  api: z.string().nullish(),
  npm: z.string().nullish(),
  models: z.record(z.string(), z.unknown()),
});

export const modelsDevPayloadSchema = z.record(z.string(), z.unknown());

export type ModelsDevModel = z.infer<typeof modelsDevModelSchema>;
export type ModelsDevProvider = z.infer<typeof modelsDevProviderSchema>;

// ---- OpenRouter (https://openrouter.ai/api/v1/models) — used for benchmarks

export const openRouterModelSchema = z.object({
  id: z.string().min(1),
  canonical_slug: z.string().nullish(),
  benchmarks: z
    .object({
      artificial_analysis: z
        .record(z.string(), z.number().finite().nullable())
        .nullish(),
      design_arena: z
        .array(
          z.object({
            arena: z.string(),
            category: z.string(),
            elo: z.number().finite(),
            rank: z.number().nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
});

export const openRouterPayloadSchema = z.object({ data: z.array(z.unknown()) });

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>;
