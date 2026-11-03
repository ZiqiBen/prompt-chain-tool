"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

export function Submit({ children, pendingText="Saving…" }: {children:React.ReactNode;pendingText?:string}) {
  const { pending }=useFormStatus();
  return <button className="button primary" type="submit" disabled={pending}>{pending?<><span className="spinner"/>{pendingText}</>:children}</button>;
}
export function DeleteButton({ action, id, chainId, label, message }: { action:(form:FormData)=>Promise<void>;id:string;chainId?:string;label:string;message:string }) {
  const [pending,setPending]=useState(false);
  return <form action={action} onSubmit={event=>{if (!window.confirm(message)) event.preventDefault();else setPending(true);}}><input type="hidden" name="id" value={id}/>{chainId&&<input type="hidden" name="chain_id" value={chainId}/>}<button className="button danger" disabled={pending}>{pending?"Deleting…":label}</button></form>;
}
export function OutputTools({ output, name="output" }: { output:string;name?:string }) {
  const [copied,setCopied]=useState(false);
  return <div className="row"><button type="button" className="button small" onClick={async()=>{try{await navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}}}>{copied?"Copied":"Copy text"}</button><a className="button small" href={`data:text/plain;charset=utf-8,${encodeURIComponent(output)}`} download={`${name.replace(/[^a-z0-9_-]/gi,"-")}.txt`}>Download .txt</a></div>;
}
