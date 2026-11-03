import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ChainForm } from "@/components/Forms";
export default async function NewChain(){await requireAdmin();return <div className="narrow"><Link className="back-link" href="/chains">← Prompt chains</Link><header className="page-header"><div><p className="eyebrow">NEW WORKFLOW</p><h1>Create a prompt chain</h1><p className="muted">Give your workflow a name. You&apos;ll add the steps next.</p></div></header><section className="panel"><ChainForm/></section></div>;}
