import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
export async function POST(request:Request) {
  const origin=new URL(request.url).origin;
  if (request.headers.get("origin")&&request.headers.get("origin")!==origin) return new Response("Invalid origin",{status:403});
  const form=await request.formData();const requested=String(form.get("next")??"/chains");
  const next=requested.startsWith("/")&&!requested.startsWith("//")&&!requested.includes("\\")?requested:"/chains";
  (await cookies()).set("studio-next",next,{httpOnly:true,sameSite:"lax",secure:origin.startsWith("https:"),path:"/",maxAge:600});
  const supabase=await db();
  const {data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${origin}/auth/callback`}});
  return NextResponse.redirect(error||!data.url?new URL("/login?error=oauth",origin):data.url,303);
}
