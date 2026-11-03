export type PipelineStep = { id: string; name: string; prompt_template: string; model_key: string };
export type StepResult = { step: PipelineStep; position: number; prompt: string; output: string; durationMs: number; promptTokens: number | null; completionTokens: number | null };
export type ImageInput = { mimeType: string; data: string };

export function renderPrompt(template: string, input: string, language: string, outputs: string[]) {
  return template.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_match, variable: string) => {
    if (variable === "input" || variable === "user_question") return input;
    if (variable === "preferred_language") return language;
    if (variable === "previous_output") return outputs.at(-1) ?? "";
    const step = /^step_(\d+)$/.exec(variable);
    if (step && Number(step[1]) >= 1 && Number(step[1]) <= outputs.length) return outputs[Number(step[1]) - 1];
    throw new Error(`The prompt uses {{${variable}}}, which is not available at this step.`);
  });
}

export async function runPipeline(options: {
  steps: PipelineStep[]; input: string; language: string; apiKey: string;
  image?: ImageInput; signal?: AbortSignal; fetchImpl?: typeof fetch;
  onStart?: (step: PipelineStep, position: number) => void | Promise<void>;
  onComplete?: (result: StepResult) => void | Promise<void>;
}) {
  if (!options.steps.length) throw new Error("Add at least one step before running this chain.");
  const outputs: string[] = [];
  for (const [index, step] of options.steps.entries()) {
    options.signal?.throwIfAborted();
    if (!/^gemini-[a-z0-9.-]+$/i.test(step.model_key)) throw new Error("This tool supports Gemini models. Choose an active Gemini model.");
    const instruction = renderPrompt(step.prompt_template, options.input, options.language, outputs);
    const prompt = `Follow the instruction below and return the requested content.\n\nInstruction:\n${instruction}\n\nOriginal input:\n${options.input}\n\nPreferred programming language: ${options.language}${outputs.length ? `\n\nOutput from the previous step:\n${outputs.at(-1)}` : ""}`;
    await options.onStart?.(step, index + 1);
    const startedAt = Date.now();
    const parts: ({ text: string } | { inlineData: ImageInput })[] = [{ text: prompt }];
    if (index === 0 && options.image) parts.push({ inlineData: options.image });
    const response = await (options.fetchImpl ?? fetch)(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(step.model_key)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
        signal: AbortSignal.any([AbortSignal.timeout(45000), ...(options.signal ? [options.signal] : [])]),
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.6, maxOutputTokens: 2048 } }),
      },
    );
    if (!response.ok) {
      if (response.status === 429) throw new Error("Gemini's quota or rate limit was reached. Please try again later.");
      throw new Error(`Gemini could not run this step (HTTP ${response.status}). Check the server API key and the selected model.`);
    }
    const data = await response.json();
    const output = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((part: { text?: string; thought?: boolean }) => typeof part.text === "string" && !part.thought)
      .map((part: { text: string }) => part.text).join("\n").trim();
    if (!output) throw new Error("Gemini returned no output. Try a different prompt or model.");
    const result: StepResult = {
      step, position: index + 1, prompt, output, durationMs: Date.now() - startedAt,
      promptTokens: data.usageMetadata?.promptTokenCount ?? null,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? null,
    };
    await options.onComplete?.(result);
    outputs.push(output);
  }
  return outputs.at(-1)!;
}
