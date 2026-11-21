import { revalidateTag } from "next/cache";
import { ApiError, ok, route } from "@/server/http";
import { runIngestion } from "@/server/ingest/pipeline";

// Ingestion takes a few seconds locally; allow headroom on serverless.
export const maxDuration = 300;

/**
 * GET /api/cron/ingest — called daily by Vercel Cron (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; anyone else gets 401.
 */
export const GET = route(async (request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new ApiError(401, "unauthorized", "Missing or invalid cron secret.");
  }
  const result = await runIngestion({ trigger: "cron" });
  // Mark every cached catalog query stale; pages refresh on their next visit.
  revalidateTag("catalog", "max");
  return ok(result, undefined, { cache: false });
});
