import "server-only";
import type { z } from "zod";
import { toParamRecord } from "@/lib/query-schemas";

/**
 * Small toolkit so every route handler behaves the same way:
 *   success → { data, meta? }       error → { error: { code, message, details? } }
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);

/** CDN-cacheable for 5 min, then served stale for up to a day while revalidating. */
const PUBLIC_CACHE = "public, s-maxage=300, stale-while-revalidate=86400";

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: { cache?: boolean }) {
  return Response.json(meta ? { data, meta } : { data }, {
    headers: init?.cache === false ? { "Cache-Control": "no-store" } : { "Cache-Control": PUBLIC_CACHE },
  });
}

export function parseQuery<S extends z.ZodType>(schema: S, params: URLSearchParams): z.output<S> {
  const result = schema.safeParse(toParamRecord(params));
  if (!result.success) {
    throw new ApiError(
      400,
      "invalid_query",
      "One or more query parameters are invalid.",
      result.error.issues.map((i) => ({ param: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a handler with consistent error responses and server-side logging. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status, headers: { "Cache-Control": "no-store" } },
        );
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, err);
      return Response.json(
        { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
