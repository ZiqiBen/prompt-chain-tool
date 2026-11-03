import Link from "next/link";
import { notFound } from "next/navigation";
import { loadChain } from "@/lib/data";
import { StepForm } from "@/components/Forms";
import type { Model } from "@/lib/types";
export default async function EditStep({
  params,
}: PageProps<"/chains/[id]/steps/[stepId]">) {
  const { id, stepId } = await params;
  const { supabase, chain, steps } = await loadChain(id);
  const step = steps.find((s) => s.id === stepId);
  if (!step) notFound();
  const { data, error } = await supabase
    .from("llm_models")
    .select("id,name,model_key,is_active")
    .eq("is_active", true)
    .like("model_key", "gemini-%")
    .returns<Model[]>();
  if (error) throw new Error("The models could not be loaded.");
  return (
    <div className="narrow">
      <Link className="back-link" href={`/chains/${id}`}>
        ← {chain.name}
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">STEP {step.step_order}</p>
          <h1>Edit step</h1>
        </div>
      </header>
      <section className="panel">
        <StepForm chainId={id} step={step} models={data ?? []} />
      </section>
      <details className="metadata">
        <summary>Step information</summary>
        <p>
          ID: <code>{step.id}</code>
        </p>
        <p>
          Chain ID: <code>{id}</code>
        </p>
      </details>
    </div>
  );
}
