import Link from "next/link";
import { loadChain } from "@/lib/data";
import { ChainForm } from "@/components/Forms";
import { DeleteButton } from "@/components/Controls";
import { deleteChain } from "@/app/actions";
export default async function EditChain({params}:PageProps<"/chains/[id]/edit">){const {id}=await params;const {chain}=await loadChain(id);return <div className="narrow"><Link className="back-link" href={`/chains/${id}`}>← {chain.name}</Link><header className="page-header"><div><p className="eyebrow">WORKFLOW SETTINGS</p><h1>Edit chain</h1></div></header><section className="panel"><ChainForm chain={chain}/></section><section className="panel danger-zone"><h2>Delete this chain</h2><p className="muted">The chain and its steps will be removed. Saved runs keep their original inputs and outputs.</p><DeleteButton action={deleteChain} id={id} label="Delete chain" message={`Delete “${chain.name}” and all its steps? Saved runs will be kept.`}/></section></div>;}
