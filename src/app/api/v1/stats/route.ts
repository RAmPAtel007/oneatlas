import { ok, route } from "@/server/http";
import { getCatalogStats } from "@/server/services/catalog";

/** GET /api/v1/stats — catalog totals, capability coverage and last sync time. */
export const GET = route(async () => ok(await getCatalogStats()));
