import { ok, route } from "@/server/http";
import { listProviders } from "@/server/services/catalog";

/** GET /api/v1/providers — inference providers with catalog size and cheapest input price. */
export const GET = route(async () => ok(await listProviders()));
