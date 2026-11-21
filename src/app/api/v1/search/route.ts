import { searchQuerySchema } from "@/lib/query-schemas";
import { ok, parseQuery, route } from "@/server/http";
import { globalSearch } from "@/server/services/catalog";

/** GET /api/v1/search?q=gemni — typo-tolerant search across models, labs and providers. */
export const GET = route(async (request) => {
  const { q, limit } = parseQuery(searchQuerySchema, new URL(request.url).searchParams);
  return ok(await globalSearch(q, limit));
});
