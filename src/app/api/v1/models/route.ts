import { modelListQuerySchema } from "@/lib/query-schemas";
import { ok, parseQuery, route } from "@/server/http";
import { listModels } from "@/server/services/models";

/**
 * GET /api/v1/models
 * Search, filter, sort and paginate the model catalog.
 * e.g. /api/v1/models?q=claude&cap=reasoning,vision&sort=price&page=2
 */
export const GET = route(async (request) => {
  const query = parseQuery(modelListQuerySchema, new URL(request.url).searchParams);
  const { items, ...pagination } = await listModels(query);
  return ok(items, { pagination, query });
});
