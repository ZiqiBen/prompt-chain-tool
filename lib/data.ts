import { notFound } from "next/navigation";
import { requireAdmin, uuid } from "./auth";
import type { Chain, Step } from "./types";
export async function loadChain(id: string) {
  if (!uuid(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select("*, prompt_chain_steps(*)")
    .eq("id", id)
    .maybeSingle<Chain & { prompt_chain_steps: Step[] }>();
  if (error) throw new Error("The prompt chain could not be loaded.");
  if (!data) notFound();
  return {
    supabase,
    chain: data,
    steps: [...data.prompt_chain_steps].sort(
      (a, b) => a.step_order - b.step_order,
    ),
  };
}
export function when(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
