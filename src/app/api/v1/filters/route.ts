import { ok, route } from "@/server/http";
import { getFilterOptions } from "@/server/services/models";

/** GET /api/v1/filters — facet values (labs, providers, types) with model counts. */
export const GET = route(async () => ok(await getFilterOptions()));
