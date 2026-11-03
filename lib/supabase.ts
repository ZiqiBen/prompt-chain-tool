import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const AUTH_COOKIE = "prompt-studio-auth";

export async function db() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createServerClient(url, key, {
    cookieOptions: { name: AUTH_COOKIE, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { for (const { name, value, options } of values) store.set(name, value, options); }
        catch { /* Session refresh is handled by proxy.ts for Server Components. */ }
      },
    },
  });
}
