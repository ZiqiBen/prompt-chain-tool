import test from "node:test";
import assert from "node:assert/strict";
import { renderPrompt, runPipeline } from "../lib/pipeline.ts";
const step = (name, prompt = name) => ({
  id: name,
  name,
  prompt_template: prompt,
  model_key: "gemini-3.5-flash-lite",
});
const response = (text) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
test("resolves original, previous, named step, and language variables without interpreting output as another template", () => {
  assert.equal(
    renderPrompt(
      "{{input}} | {{previous_output}} | {{step_1}} | {{preferred_language}}",
      "{{literal}}",
      "Python",
      ["one", "two"],
    ),
    "{{literal}} | two | one | Python",
  );
  assert.throws(
    () => renderPrompt("{{step_2}}", "x", "Python", ["one"]),
    /not available/,
  );
});
test("executes in supplied order and passes actual preceding output into the next prompt", async () => {
  const prompts = [],
    results = [];
  const output = await runPipeline({
    steps: [step("second"), step("first", "Rewrite {{previous_output}}")],
    input: "original",
    language: "Python",
    apiKey: "test",
    fetchImpl: async (_url, options) => {
      prompts.push(JSON.parse(options.body));
      return response(prompts.length === 1 ? "analysis" : "final");
    },
    onComplete: (r) => results.push(r),
  });
  assert.equal(output, "final");
  assert.match(prompts[0].contents[0].parts[0].text, /second/);
  assert.match(prompts[1].contents[0].parts[0].text, /Rewrite analysis/);
  assert.match(
    prompts[1].contents[0].parts[0].text,
    /Output from the previous step:\nanalysis/,
  );
  assert.deepEqual(
    results.map((r) => r.position),
    [1, 2],
  );
  assert.equal(results[0].promptTokens, 10);
});
test("passes optional image to only the first step", async () => {
  const counts = [];
  await runPipeline({
    steps: [step("describe"), step("caption")],
    input: "image",
    language: "Python",
    apiKey: "test",
    image: { mimeType: "image/png", data: "test" },
    fetchImpl: async (_u, o) => {
      counts.push(JSON.parse(o.body).contents[0].parts.length);
      return response("result");
    },
  });
  assert.deepEqual(counts, [2, 1]);
});
test("a failed step stops the workflow without fabricated outputs or later provider calls", async () => {
  let calls = 0,
    saved = 0;
  await assert.rejects(
    runPipeline({
      steps: [step("one"), step("two"), step("three")],
      input: "x",
      language: "Python",
      apiKey: "test",
      fetchImpl: async () => {
        calls++;
        return calls === 1
          ? response("saved")
          : new Response("", { status: 429 });
      },
      onComplete: () => {
        saved++;
      },
    }),
    /quota/,
  );
  assert.equal(calls, 2);
  assert.equal(saved, 1);
});
test("rejects empty chains, unavailable variables, invalid model URLs, and empty provider responses", async () => {
  const base = {
    input: "x",
    language: "Python",
    apiKey: "test",
    fetchImpl: async () => response(""),
  };
  await assert.rejects(runPipeline({ ...base, steps: [] }), /at least one/);
  await assert.rejects(
    runPipeline({ ...base, steps: [step("one", "{{unknown}}")] }),
    /not available/,
  );
  await assert.rejects(
    runPipeline({
      ...base,
      steps: [{ ...step("one"), model_key: "https://example.com" }],
    }),
    /supports Gemini/,
  );
  await assert.rejects(
    runPipeline({ ...base, steps: [step("one")] }),
    /no output/,
  );
});
test("does not expose thought parts as generated media", async () => {
  const out = await runPipeline({
    steps: [step("one")],
    input: "x",
    language: "Python",
    apiKey: "test",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "private reasoning", thought: true },
                  { text: "answer" },
                ],
              },
            },
          ],
        }),
      ),
  });
  assert.equal(out, "answer");
});
