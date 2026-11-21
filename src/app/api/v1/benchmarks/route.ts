import { ok, route } from "@/server/http";
import { listBenchmarks } from "@/server/services/catalog";

/** GET /api/v1/benchmarks — available benchmarks grouped by category. */
export const GET = route(async () => ok(await listBenchmarks()));
