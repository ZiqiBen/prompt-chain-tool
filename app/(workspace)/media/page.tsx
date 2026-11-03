import Link from "next/link";
import { requireAdmin,uuid } from "@/lib/auth";
import { when } from "@/lib/data";
import type { Run } from "@/lib/types";
export default async function Media({searchParams}:{searchParams:Promise<{chain?:string}>}){
 const {supabase}=await requireAdmin();const selected=(await searchParams).chain??"";
 let query=supabase.from("prompt_chain_runs").select("*").order("created_at",{ascending:false}).limit(50);
 if(uuid(selected))query=query.eq("prompt_chain_id",selected);
 const [runs,chains]=await Promise.all([query.returns<Run[]>(),supabase.from("prompt_chains").select("id,name").order("name")]);
 return <><header className="page-header"><div><p className="eyebrow">RUN HISTORY</p><h1>Generated media</h1><p className="muted">The latest 50 runs, including each workflow&apos;s final text and step outputs.</p></div></header><form className="list-toolbar" method="get"><label className="filter-label">Prompt chain<select name="chain" defaultValue={selected}><option value="">All chains</option>{chains.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="button">Apply filter</button></form>{runs.error?<p className="notice error">Run history could not be loaded. Please refresh.</p>:runs.data?.length?<div className="chain-grid">{runs.data.map(run=><Link className="panel run-card" href={`/runs/${run.id}`} key={run.id}><div className="row between"><span className={`badge ${run.status==="completed"?"green":run.status==="failed"?"red":""}`}>{run.status}</span><small className="muted">{when(run.created_at)} ET</small></div><h2>{run.chain_name}</h2><p className="muted clamp">{run.input_text}</p><p className="clamp">{run.output_text??run.error_message??"The chain is running…"}</p><span className="text-link">View output →</span></Link>)}</div>:<div className="panel empty"><span className="empty-symbol">▤</span><h2>No generated content yet</h2><p className="muted">Run a prompt chain to see its results here.</p><Link className="button primary" href="/chains">Browse chains</Link></div>}</>;
}
