import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" ? v : undefined;
}

export function supaServer() {
  const cookieStore = cookies();
  const url = (
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    getEnv("SUPABASE_URL") ||
    getEnv("NEXT_PUBLIC_SUPABASE_PROJECT_URL") ||
    ""
  ).trim().replace(/\/$/, "");
  const key = (
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_KEY") ||
    ""
  ).trim();
  if (!url || !key) {
    throw new Error("Supabase env vars missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll: async () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: async (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value, options } of cookiesToSet) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          }
        }
      }
    }
  );
}
