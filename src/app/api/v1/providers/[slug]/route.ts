import { notFound, ok, route } from "@/server/http";
import { getProvider } from "@/server/services/catalog";

/** GET /api/v1/providers/{slug} — a provider and every model it serves, with prices. */
export const GET = route(async (_request, ctx: RouteContext<"/api/v1/providers/[slug]">) => {
  const { slug } = await ctx.params;
  const provider = await getProvider(slug.toLowerCase());
  if (!provider) throw notFound(`Provider "${slug}"`);
  return ok(provider);
});
