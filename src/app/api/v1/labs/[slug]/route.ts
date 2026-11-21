import { notFound, ok, route } from "@/server/http";
import { getLab } from "@/server/services/catalog";

/** GET /api/v1/labs/{slug} — lab profile, its models and where they're served. */
export const GET = route(async (_request, ctx: RouteContext<"/api/v1/labs/[slug]">) => {
  const { slug } = await ctx.params;
  const lab = await getLab(slug.toLowerCase());
  if (!lab) throw notFound(`Lab "${slug}"`);
  return ok(lab);
});
