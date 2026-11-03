"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveChain, saveStep } from "@/app/actions";
import { Submit } from "./Controls";
import type { Chain, Step, Model } from "@/lib/types";

export function ChainForm({ chain }: { chain?: Chain }) {
  const [state, action, pending] = useActionState(saveChain, {});
  const [name, setName] = useState(chain?.name ?? "");
  const [description, setDescription] = useState(chain?.description ?? "");
  const [active, setActive] = useState(chain?.is_active ?? true);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={chain?.id ?? ""} />
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending} className="stack">
        <label>
          Name
          <input
            autoFocus
            name="name"
            required
            maxLength={100}
            placeholder="e.g. Coding explainer"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="What should this workflow produce?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="is_active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active — ready to run
        </label>
        <div className="row">
          <Submit>{chain ? "Save changes" : "Create chain"}</Submit>
          <Link
            className="button"
            href={chain ? `/chains/${chain.id}` : "/chains"}
          >
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  );
}

export function StepForm({
  chainId,
  step,
  models,
}: {
  chainId: string;
  step?: Step;
  models: Model[];
}) {
  const [state, action, pending] = useActionState(saveStep, {});
  const [name, setName] = useState(step?.name ?? "");
  const [prompt, setPrompt] = useState(step?.prompt_template ?? "");
  const [model, setModel] = useState(step?.model_id ?? "");
  return (
    <form action={action} className="stack">
      <input type="hidden" name="chain_id" value={chainId} />
      <input type="hidden" name="id" value={step?.id ?? ""} />
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <fieldset disabled={pending} className="stack">
        <label>
          Name
          <input
            autoFocus
            name="name"
            required
            maxLength={100}
            placeholder="e.g. Explain the solution"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Model
          <select
            name="model_id"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Default Gemini model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.model_key})
              </option>
            ))}
          </select>
        </label>
        <label>
          Prompt template
          <textarea
            className="mono"
            name="prompt_template"
            rows={9}
            required
            maxLength={12000}
            placeholder="Explain how to solve {{input}} using the analysis in {{previous_output}}."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <details className="help">
          <summary>Input variables and step context</summary>
          <p>
            Use <code>{"{{input}}"}</code> for the original input,{" "}
            <code>{"{{previous_output}}"}</code> for the previous step,{" "}
            <code>{"{{step_1}}"}</code> for an earlier step, and{" "}
            <code>{"{{preferred_language}}"}</code> for the chosen language. The
            original input and previous output are also provided automatically.
            Images are passed to the first step.
          </p>
        </details>
        <div className="row">
          <Submit>{step ? "Save step" : "Add step"}</Submit>
          <Link className="button" href={`/chains/${chainId}`}>
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
