import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
export async function GET(request:Request) {
  const url=new URL(request.url),code=url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=callback",url.origin));
  const supabase=await db();const {error}=await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=session",url.origin));
  const store=await cookies();const requested=store.get("studio-next")?.value??"/chains";store.delete("studio-next");
  const next=requested.startsWith("/")&&!requested.startsWith("//")&&!requested.includes("\\")?requested:"/chains";
  return NextResponse.redirect(new URL(next,url.origin));
}
