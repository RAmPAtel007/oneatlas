import { ok, route } from "@/server/http";
import { listLabs } from "@/server/services/catalog";

/** GET /api/v1/labs — every AI lab with model counts and latest release. */
export const GET = route(async () => ok(await listLabs()));
