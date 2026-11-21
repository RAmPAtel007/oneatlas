import { notFound, ok, route } from "@/server/http";
import { getModelDetail, getRelatedModels } from "@/server/services/models";

/** GET /api/v1/models/{lab}/{model} — full model detail incl. providers and benchmarks. */
export const GET = route(async (_request, ctx: RouteContext<"/api/v1/models/[...slug]">) => {
  const { slug } = await ctx.params;
  const id = slug.map(decodeURIComponent).join("/").toLowerCase();
  const [model, related] = await Promise.all([getModelDetail(id), getRelatedModels(id)]);
  if (!model) throw notFound(`Model "${id}"`);
  return ok({ ...model, related });
});
