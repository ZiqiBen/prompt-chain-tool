import { ThemePicker } from "@/components/ThemePicker";
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;next?:string}>}) {
  const query=await searchParams;
  const next=query.next?.startsWith("/")&&!query.next.startsWith("//")?query.next:"/chains";
  return <main className="login-shell"><div className="login-theme"><ThemePicker/></div><section className="panel login-card"><div className="brand-mark">⌘</div><p className="eyebrow">PATTERN / PROMPT STUDIO</p><h1>Good ideas,<br/>one step at a time.</h1><p className="muted">Build prompt chains, connect the steps, and turn an input into something useful.</p><div className="login-divider"/><h2>Sign in to your workspace</h2><p className="muted">Use your Google account with superadmin access.</p>{query.error&&<p className="notice error" role="alert">Sign-in could not be completed. Please try again.</p>}<form action="/auth/login" method="post"><input type="hidden" name="next" value={next}/><button className="button primary wide">Continue with Google <span aria-hidden="true">↗</span></button></form><p className="hint">Access is checked against your existing admin profile.</p></section></main>;
}
