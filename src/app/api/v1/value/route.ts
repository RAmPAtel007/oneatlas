import { ok, route } from "@/server/http";
import { getValueLandscape } from "@/server/services/catalog";

/** GET /api/v1/value — intelligence vs blended price, with the Pareto frontier flagged. */
export const GET = route(async () => ok(await getValueLandscape()));
