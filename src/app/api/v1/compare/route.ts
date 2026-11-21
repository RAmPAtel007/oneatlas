import { compareQuerySchema } from "@/lib/query-schemas";
import { ok, parseQuery, route } from "@/server/http";
import { getModelsForCompare } from "@/server/services/models";

/** GET /api/v1/compare?models=openai/gpt-6-astra,anthropic/claude-opus-5-5 (max 4) */
export const GET = route(async (request) => {
  const { models } = parseQuery(compareQuerySchema, new URL(request.url).searchParams);
  const data = await getModelsForCompare(models);
  const found = new Set(data.map((m) => m.slug));
  return ok(data, { missing: models.filter((s) => !found.has(s)) });
});
