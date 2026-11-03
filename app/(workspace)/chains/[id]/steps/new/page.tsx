import Link from "next/link";
import { loadChain } from "@/lib/data";
import { StepForm } from "@/components/Forms";
import type { Model } from "@/lib/types";
export default async function NewStep({
  params,
}: PageProps<"/chains/[id]/steps/new">) {
  const { id } = await params;
  const { supabase, chain } = await loadChain(id);
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
          <p className="eyebrow">NEW STEP</p>
          <h1>What happens next?</h1>
          <p className="muted">
            The new step is added at the end. You can reorder it later.
          </p>
        </div>
      </header>
      <section className="panel">
        <StepForm chainId={id} models={data ?? []} />
      </section>
    </div>
  );
}
