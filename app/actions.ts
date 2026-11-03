"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, uuid } from "@/lib/auth";
import { db } from "@/lib/supabase";

export type FormState = { error?: string };
function text(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function signOut() {
  const supabase = await db();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function saveChain(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const id = text(form, "id"),
    name = text(form, "name"),
    description = text(form, "description");
  if (
    (id && !uuid(id)) ||
    !name ||
    name.length > 100 ||
    description.length > 2000
  )
    return {
      error:
        "Enter a name of up to 100 characters and a description of up to 2,000 characters.",
    };
  const values = {
    name,
    description: description || null,
    is_active: form.has("is_active"),
  };
  const result = id
    ? await supabase
        .from("prompt_chains")
        .update(values)
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase.from("prompt_chains").insert(values).select("id").single();
  if (result.error || !result.data)
    return { error: "The chain could not be saved. Please try again." };
  revalidatePath("/chains");
  revalidatePath(`/chains/${result.data.id}`);
  redirect(`/chains/${result.data.id}?notice=saved`);
}

export async function deleteChain(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = text(form, "id");
  if (!uuid(id)) throw new Error("Invalid chain.");
  const { data, error } = await supabase
    .from("prompt_chains")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    redirect(
      `/chains/${id}?error=${encodeURIComponent("The chain could not be deleted.")}`,
    );
  revalidatePath("/chains");
  revalidatePath("/media");
  redirect("/chains?notice=deleted");
}

export async function saveStep(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const chainId = text(form, "chain_id"),
    id = text(form, "id"),
    name = text(form, "name"),
    prompt = text(form, "prompt_template"),
    modelId = text(form, "model_id");
  if (
    !uuid(chainId) ||
    (id && !uuid(id)) ||
    (modelId && !uuid(modelId)) ||
    !name ||
    name.length > 100 ||
    !prompt ||
    prompt.length > 12000
  )
    return { error: "Enter a name and prompt, and choose a valid model." };
  const { error } = await supabase.rpc("studio_save_step", {
    p_chain_id: chainId,
    p_step_id: id || null,
    p_name: name,
    p_prompt: prompt,
    p_model_id: modelId || null,
  });
  if (error)
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "The step could not be saved. Please try again.",
    };
  revalidatePath(`/chains/${chainId}`);
  revalidatePath("/chains");
  redirect(`/chains/${chainId}?notice=step-saved`);
}

export async function moveStep(form: FormData) {
  const { supabase } = await requireAdmin();
  const chainId = text(form, "chain_id"),
    id = text(form, "id"),
    direction = Number(text(form, "direction"));
  if (!uuid(chainId) || !uuid(id) || ![-1, 1].includes(direction))
    throw new Error("Invalid move.");
  const { error } = await supabase.rpc("studio_move_step", {
    p_chain_id: chainId,
    p_step_id: id,
    p_direction: direction,
  });
  revalidatePath(`/chains/${chainId}`);
  redirect(
    `/chains/${chainId}?${error ? "error=" + encodeURIComponent("The step could not be moved. Refresh and try again.") : "notice=reordered"}`,
  );
}

export async function deleteStep(form: FormData) {
  const { supabase } = await requireAdmin();
  const chainId = text(form, "chain_id"),
    id = text(form, "id");
  if (!uuid(chainId) || !uuid(id)) throw new Error("Invalid step.");
  const { error } = await supabase.rpc("studio_delete_step", {
    p_chain_id: chainId,
    p_step_id: id,
  });
  revalidatePath(`/chains/${chainId}`);
  revalidatePath("/chains");
  redirect(
    `/chains/${chainId}?${error ? "error=" + encodeURIComponent("The step could not be deleted.") : "notice=step-deleted"}`,
  );
}
