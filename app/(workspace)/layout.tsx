import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { ThemePicker } from "@/components/ThemePicker";
export default async function Workspace({children}:{children:React.ReactNode}) {
  const {user}=await requireAdmin();
  return <div className="workspace"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar"><Link className="brand" href="/chains"><span className="brand-mark small-mark">⌘</span><span>Pattern<span className="brand-sub">PROMPT STUDIO</span></span></Link><p className="nav-caption">WORKSPACE</p><nav aria-label="Workspace"><Link href="/chains"><span aria-hidden="true">▦</span> Prompt chains</Link><Link href="/media"><span aria-hidden="true">▤</span> Generated media</Link></nav><div className="sidebar-bottom"><ThemePicker/><div className="external-links"><a href="https://week1-hello-world.vercel.app" target="_blank" rel="noreferrer">Public app ↗</a><a href="https://week6-admin-panel.vercel.app/admin" target="_blank" rel="noreferrer">Admin area ↗</a></div><div className="account"><span className="avatar">{user.email?.slice(0,1).toUpperCase()??"A"}</span><div><span className="badge">Superadmin</span><span className="account-email" title={user.email}>{user.email}</span></div></div><form action={signOut}><button className="button quiet wide">Sign out</button></form></div></aside><main id="main" className="main">{children}</main></div>;
}
