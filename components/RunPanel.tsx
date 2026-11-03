"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OutputTools } from "./Controls";

type Progress = {
  position: number;
  name: string;
  output?: string;
  durationMs?: number;
};
export function RunPanel({
  chainId,
  count,
  ready,
  active,
}: {
  chainId: string;
  count: number;
  ready: boolean;
  active: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [steps, setSteps] = useState<Progress[]>([]),
    [output, setOutput] = useState(""),
    [runId, setRunId] = useState("");
  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const image = form.get("image");
    if (image instanceof File && image.size > 3 * 1024 * 1024) {
      setError("Choose an image under 3 MB.");
      return;
    }
    setRunning(true);
    setError("");
    setSteps([]);
    setOutput("");
    setRunId("");
    let finished = false;
    try {
      const response = await fetch(`/api/chains/${chainId}/run`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "The run could not start.");
      }
      if (!response.body)
        throw new Error("The server did not return a stream.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const message of messages) {
          const line = message.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "run_started") setRunId(data.runId);
          if (data.type === "step_started")
            setSteps((old) => [
              ...old,
              { position: data.position, name: data.name },
            ]);
          if (data.type === "step_completed")
            setSteps((old) =>
              old.map((step) =>
                step.position === data.position
                  ? {
                      ...step,
                      output: data.output,
                      durationMs: data.durationMs,
                    }
                  : step,
              ),
            );
          if (data.type === "completed") {
            setOutput(data.output);
            finished = true;
          }
          if (data.type === "failed") {
            setError(data.error);
            finished = true;
          }
        }
        if (done) break;
      }
      if (!finished)
        throw new Error(
          "The connection was interrupted. Open the saved run to check its status.",
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The run failed.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }
  return (
    <div className="run-layout">
      <div className="panel">
        <h2>Run this chain</h2>
        <p className="muted">
          {count} steps, executed in order. Each step receives the previous
          output.
        </p>
        {!ready && (
          <p className="notice error">
            Generation is unavailable until the server&apos;s Gemini API key is
            configured.
          </p>
        )}
        {!active && (
          <p className="notice">Activate this chain to generate content.</p>
        )}
        {!count && <p className="notice">Add a step to start generating.</p>}
        <form onSubmit={run} className="stack">
          <fieldset className="stack" disabled={running}>
            <label>
              Input
              <textarea
                name="input"
                maxLength={12000}
                rows={5}
                placeholder="e.g. Explain how a sliding window finds the longest substring without repeating characters."
              />
            </label>
            <label>
              Programming language
              <select name="language" defaultValue="Python">
                {["Python", "JavaScript", "TypeScript", "Java", "C++"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Image <span className="muted">(optional)</span>
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
              />
              <span className="hint">
                PNG, JPEG, or WebP, up to 3 MB. Sent to the first step; the
                image itself is not saved.
              </span>
            </label>
            <button
              className="button primary"
              disabled={running || !ready || !active || !count}
            >
              {running ? (
                <>
                  <span className="spinner" />
                  Generating…
                </>
              ) : (
                "▶ Run chain"
              )}
            </button>
          </fieldset>
        </form>
      </div>
      <div className="panel">
        <div className="row between">
          <h2>Output</h2>
          {runId && (
            <Link className="text-link" href={`/runs/${runId}`}>
              View saved run ↗
            </Link>
          )}
        </div>
        <div aria-live="polite" className="stack">
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {!steps.length && !error && (
            <div className="empty">
              <span className="empty-symbol">↗</span>
              <p>Your result will appear here.</p>
              <span className="muted">Follow each step as it runs.</span>
            </div>
          )}
          {steps.map((step) => (
            <details key={step.position} className="progress-step">
              <summary>
                <span className={step.output ? "success" : "muted"}>
                  {step.output ? "✓" : "◌"}
                </span>
                <span>
                  {step.position}. {step.name}
                </span>
                <small>
                  {step.durationMs != null
                    ? `${(step.durationMs / 1000).toFixed(1)}s`
                    : running
                      ? "Running…"
                      : "Stopped"}
                </small>
              </summary>
              {step.output && <pre className="output">{step.output}</pre>}
            </details>
          ))}
          {output && (
            <div className="final-output">
              <div className="row between">
                <h3>Final result</h3>
                <OutputTools output={output} />
              </div>
              <pre className="output">{output}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
