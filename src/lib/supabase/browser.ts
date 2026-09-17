"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function supabaseBrowser() {
  const { url, anon } = publicEnv();
  return createBrowserClient(url, anon);
}
