import { getAdmin, uuid } from "@/lib/auth";
import {
  runPipeline,
  type PipelineStep,
  type ImageInput,
} from "@/lib/pipeline";
import type { Chain, Step, Model } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/chains/[id]/run">,
) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const { supabase, user, allowed } = await getAdmin();
  if (!user)
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!allowed)
    return Response.json(
      { error: "Superadmin access is required." },
      { status: 403 },
    );
  const { id } = await params;
  if (!uuid(id))
    return Response.json({ error: "Chain not found." }, { status: 404 });
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey)
    return Response.json(
      { error: "The server's Gemini API key has not been configured." },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 4 * 1024 * 1024)
    return Response.json(
      { error: "The request is too large. Images must be under 3 MB." },
      { status: 413 },
    );

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid run input." }, { status: 400 });
  }
  const file = form.get("image");
  const hasImage = file instanceof File && file.size > 0;
  const input =
    String(form.get("input") ?? "").trim() ||
    (hasImage
      ? "Describe the image and follow the workflow instructions."
      : "");
  const language = String(form.get("language") ?? "Python");
  if (
    !input ||
    input.length > 12000 ||
    !["Python", "JavaScript", "TypeScript", "Java", "C++"].includes(language)
  )
    return Response.json(
      {
        error:
          "Enter an input of up to 12,000 characters and select a supported language.",
      },
      { status: 400 },
    );
  let image: ImageInput | undefined;
  if (hasImage) {
    if (
      file.size > 3 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      return Response.json(
        { error: "Choose a PNG, JPEG, or WebP image under 3 MB." },
        { status: 400 },
      );
    const bytes = Buffer.from(await file.arrayBuffer());
    const valid =
      file.type === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid)
      return Response.json(
        { error: "The file does not match its image format." },
        { status: 400 },
      );
    image = { mimeType: file.type, data: bytes.toString("base64") };
  }

  const { data: chain, error: chainError } = await supabase
    .from("prompt_chains")
    .select("*, prompt_chain_steps(*)")
    .eq("id", id)
    .maybeSingle<Chain & { prompt_chain_steps: Step[] }>();
  if (chainError)
    return Response.json(
      { error: "The workflow could not be loaded." },
      { status: 500 },
    );
  if (!chain)
    return Response.json({ error: "Chain not found." }, { status: 404 });
  if (!chain.is_active)
    return Response.json(
      { error: "Activate this chain before running it." },
      { status: 400 },
    );
  const steps = [...chain.prompt_chain_steps].sort(
    (a, b) => a.step_order - b.step_order,
  );
  if (!steps.length || steps.length > 20)
    return Response.json(
      { error: "A chain must have between 1 and 20 steps." },
      { status: 400 },
    );
  const modelIds = [
    ...new Set(steps.map((s) => s.model_id).filter((v): v is string => !!v)),
  ];
  const models = new Map<string, Model>();
  if (modelIds.length) {
    const { data, error } = await supabase
      .from("llm_models")
      .select("id, name, model_key, is_active")
      .in("id", modelIds);
    if (error)
      return Response.json(
        { error: "The step models could not be loaded." },
        { status: 500 },
      );
    for (const model of (data ?? []) as Model[]) models.set(model.id, model);
  }
  if (
    steps.some(
      (s) =>
        s.model_id &&
        (!models.get(s.model_id)?.is_active ||
          !models.get(s.model_id)?.model_key.startsWith("gemini-")),
    )
  )
    return Response.json(
      {
        error:
          "One of the steps uses an unavailable model. Select an active Gemini model or the default model.",
      },
      { status: 400 },
    );
  const pipeline: PipelineStep[] = steps.map((s) => ({
    id: s.id,
    name: s.name,
    prompt_template: s.prompt_template,
    model_key: s.model_id
      ? models.get(s.model_id)!.model_key
      : (process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite"),
  }));
  const { data: run, error: runError } = await supabase
    .from("prompt_chain_runs")
    .insert({
      prompt_chain_id: id,
      chain_name: chain.name,
      created_by: user.id,
      input_text: input,
      preferred_language: language,
      input_image_name: hasImage ? file.name : null,
      steps_snapshot: pipeline,
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run)
    return Response.json(
      {
        error:
          "The run could not be saved. Check that the Studio database migration has been applied.",
      },
      { status: 500 },
    );

  const encoder = new TextEncoder();
  const abort = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    abort.signal,
    AbortSignal.timeout(250000),
  ]);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type, ...(data as object) })}\n\n`,
            ),
          );
        } catch {
          /* The run status remains available after a disconnect. */
        }
      };
      send("run_started", { runId: run.id });
      try {
        const output = await runPipeline({
          steps: pipeline,
          input,
          language,
          image,
          apiKey,
          signal,
          onStart(step, position) {
            send("step_started", { name: step.name, position });
          },
          async onComplete(result) {
            const { error } = await supabase
              .from("prompt_chain_run_steps")
              .insert({
                run_id: run.id,
                step_id: result.step.id,
                step_order: result.position,
                step_name: result.step.name,
                model_key: result.step.model_key,
                prompt_text: result.prompt,
                output_text: result.output,
                duration_ms: result.durationMs,
                prompt_tokens: result.promptTokens,
                completion_tokens: result.completionTokens,
              });
            if (error)
              throw new Error(
                "This step finished, but its output could not be saved. The run was stopped.",
              );
            send("step_completed", {
              position: result.position,
              name: result.step.name,
              output: result.output,
              durationMs: result.durationMs,
            });
          },
        });
        const { error } = await supabase
          .from("prompt_chain_runs")
          .update({
            status: "completed",
            output_text: output,
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);
        if (error) throw new Error("The final run status could not be saved.");
        send("completed", { runId: run.id, output });
      } catch (error) {
        const message = signal.aborted
          ? "The run was interrupted or reached its time limit. Try again with fewer steps."
          : error instanceof Error
            ? error.message
            : "The run failed. Please try again.";
        await supabase
          .from("prompt_chain_runs")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);
        send("failed", { runId: run.id, error: message });
      } finally {
        try {
          controller.close();
        } catch {
          /* Already disconnected. */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
