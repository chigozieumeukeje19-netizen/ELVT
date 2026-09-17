import { z } from "zod";

/**
 * Read once, fail loudly. A missing service role key or JWT secret has to stop
 * the server rather than surface later as an unexplained 500 on a write.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  PORTAL_API_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(["off", "anthropic", "openai"]).default("off"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Environment is incomplete. Check: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  return { url, anon };
}

/**
 * Every AI job in the portal ships as a copyable prompt plus a paste box. The
 * real API call sits behind this flag and stays off unless it is set, so a
 * default install never reaches a paid endpoint.
 */
export function aiEnabled(): boolean {
  return (process.env.AI_PROVIDER ?? "off") !== "off";
}
