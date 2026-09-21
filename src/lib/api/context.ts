import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyClientToken } from "@/lib/client-token";
import { serverEnv } from "@/lib/env";

/**
 * The client API's request context.
 *
 * Every endpoint under /api/v1 goes through this, and the important part is
 * which Supabase client it hands back: one carrying the caller's own JWT, not
 * the service role. PostgREST reads `client_id` out of the token's claims and
 * the RLS policies do the rest, so a request for another client's row returns
 * nothing whatever the route code asks for.
 *
 * That is the requirement in Part 11.2 stated exactly: validated at the RLS
 * layer, not only in code. A route that reached for the service role and
 * filtered by hand would pass every test that checks the happy path and fail
 * the one that matters, so the service role is not available here at all.
 */

export type ApiContext = {
  clientId: string;
  userId: string;
  /** Carries the caller's JWT. Subject to every policy the client role has. */
  db: SupabaseClient;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function bearer(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function contextFrom(request: NextRequest): Promise<ApiContext> {
  const token = bearer(request);
  if (!token) throw new ApiError(401, "A client token is required.");

  let claims;
  try {
    claims = await verifyClientToken(token);
  } catch {
    // One answer for expired, forged and malformed. Telling them which is
    // telling an attacker whether they have the right shape.
    throw new ApiError(401, "That token is not valid.");
  }

  const env = serverEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { clientId: claims.client_id, userId: claims.sub, db };
}

/**
 * Wraps a handler so every endpoint answers the same way when something is
 * wrong, and so a thrown error never leaks a stack or a Postgres message to a
 * client app.
 */
export function handler(
  fn: (context: ApiContext, request: NextRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const context = await contextFrom(request);
      return await fn(context, request);
    } catch (error) {
      if (error instanceof ApiError) return apiError(error.status, error.message);
      return apiError(500, "Something went wrong.");
    }
  };
}

/** The same, for a route with a dynamic segment. */
export function handlerWithParams<P>(
  fn: (context: ApiContext, request: NextRequest, params: P) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    route: { params: Promise<P> },
  ): Promise<NextResponse> => {
    try {
      const context = await contextFrom(request);
      return await fn(context, request, await route.params);
    } catch (error) {
      if (error instanceof ApiError) return apiError(error.status, error.message);
      return apiError(500, "Something went wrong.");
    }
  };
}

/** Reads and validates a JSON body, answering 400 rather than throwing. */
export async function jsonBody<T>(
  request: NextRequest,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "The body has to be JSON.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success || parsed.data === undefined) {
    throw new ApiError(400, "That body is not the right shape.");
  }
  return parsed.data;
}

/**
 * What a write actually did, turned into the right answer.
 *
 * Nine routes shared one line: `if (error || !data || data.length === 0)
 * return notFound()`. That reads as careful and is the reason
 * POST /habit-log could ship never having worked at all. Its insert violated a
 * NOT NULL constraint on every call, the error went into the same branch as a
 * row that was not there, and the endpoint answered 404 without ever saying
 * what was wrong.
 *
 * So an error and an empty result are no longer the same thing:
 *
 *   * a refusal from the database is a refusal, and says so. Once the column
 *     grants land, a client writing a coach-only column gets 42501 here, and
 *     403 is the honest answer to that rather than a shrug.
 *   * anything else that errored is ours, gets logged with its code, and
 *     answers 500. A bug in this codebase must not read as a missing row.
 *   * no error and no rows keeps the 404, which is still correct: a write
 *     filtered out by RLS and a write against a row that does not exist are
 *     indistinguishable from here, and telling them apart would confirm the
 *     existence of a row the caller cannot see.
 */
export function writeFailure(
  error: { code?: string; message?: string } | null,
  rows: unknown[] | null | undefined,
  subject: string,
): NextResponse | null {
  if (error) {
    // 42501 is insufficient_privilege, which is both a missing column grant
    // and a row that failed a policy's WITH CHECK.
    if (error.code === "42501") {
      return apiError(403, `That is not yours to change on ${subject}.`);
    }
    if (error.code === "23505") {
      return apiError(409, `${subject} already has that entry.`);
    }
    console.error(`[api] write to ${subject} failed`, error.code, error.message);
    return apiError(500, `Could not save ${subject}.`);
  }
  if (!rows || rows.length === 0) return notFound();
  return null;
}

/**
 * The answer when a write touched nothing.
 *
 * A write filtered out by RLS and a write against a row that does not exist are
 * indistinguishable from here, and they get the same 404 on purpose: a
 * different answer would tell a caller that a row they cannot see exists.
 */
export function notFound(): NextResponse {
  return apiError(404, "Not found.");
}
