import { leaderboardQuerySchema } from "@/lib/query-schemas";
import { notFound, ok, parseQuery, route } from "@/server/http";
import { getLeaderboard } from "@/server/services/catalog";

/** GET /api/v1/benchmarks/{slug}?limit=50&openWeights=true — ranked leaderboard. */
export const GET = route(async (request, ctx: RouteContext<"/api/v1/benchmarks/[slug]">) => {
  const { slug } = await ctx.params;
  const query = parseQuery(leaderboardQuerySchema, new URL(request.url).searchParams);
  const board = await getLeaderboard(slug.toLowerCase(), query);
  if (!board) throw notFound(`Benchmark "${slug}"`);
  return ok(board.rows, { benchmark: board.benchmark });
});
