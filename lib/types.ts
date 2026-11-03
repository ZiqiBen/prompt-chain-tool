export type Chain = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type Step = {
  id: string;
  name: string;
  prompt_template: string;
  step_order: number;
  prompt_chain_id: string;
  model_id: string | null;
};
export type Model = {
  id: string;
  name: string;
  model_key: string;
  is_active: boolean;
};
export type Run = {
  id: string;
  prompt_chain_id: string | null;
  chain_name: string;
  input_text: string;
  preferred_language: string;
  input_image_name: string | null;
  status: "running" | "completed" | "failed";
  output_text: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  steps_snapshot: unknown;
};
export type RunStep = {
  id: string;
  step_order: number;
  step_name: string;
  model_key: string;
  prompt_text: string;
  output_text: string;
  duration_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
};
