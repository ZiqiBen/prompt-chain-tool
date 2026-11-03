import { redirect } from "next/navigation";
import { db } from "./supabase";

export async function getAdmin() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, allowed: false };
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, allowed: !error && profile?.is_superadmin === true };
}

export async function requireAdmin() {
  const session = await getAdmin();
  if (!session.user) redirect("/login");
  if (!session.allowed) redirect("/access-denied");
  return { supabase: session.supabase, user: session.user };
}

export function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
