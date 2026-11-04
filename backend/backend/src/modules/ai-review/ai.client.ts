import { env } from "../../config/env.js";
import { AppError } from "../../middleware/appError.js";
import { anthropicDraft, anthropicReview, anthropicStructured, anthropicToolLoop, describeAnthropicError } from "./ai.anthropic.js";
import { describeOpenAiError, openAiDraft, openAiReview, openAiStructured, openAiToolLoop } from "./ai.openai.js";
import type { AiReview, AiUsage, DraftInput, ReviewInput, StructuredInput, ToolLoopInput, ToolLoopResult } from "./ai.shared.js";

export { ReviewSchema, type AiReview, type AiTool, type AiUsage, type ReviewCriterion } from "./ai.shared.js";

/** The provider named on screens and in the access log (spec section 14: the AI provider must be identified). */
export const AI_PROVIDER = env.ai.provider === "openai" ? "OpenAI API" : "Anthropic API (Claude)";

function assertConfigured() {
  if (!env.ai.configured) {
    throw new AppError("AI review is not set up yet. Add the AI provider's API key to the server settings.", 503, "AI_NOT_CONFIGURED");
  }
}

/** Maps SDK errors to messages for the Principal; the technical detail goes to the server log. */
export function describeAiError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  console.error("AI request failed:", error);
  return describeOpenAiError(error) ?? describeAnthropicError(error) ?? new AppError("The AI review failed. Try again later.", 500, "AI_FAILED");
}

export async function runReview(input: ReviewInput): Promise<{ review: AiReview; usage: AiUsage }> {
  assertConfigured();
  return env.ai.provider === "openai" ? openAiReview(input) : anthropicReview(input);
}

export async function runDraft(input: DraftInput): Promise<{ text: string; usage: AiUsage }> {
  assertConfigured();
  return env.ai.provider === "openai" ? openAiDraft(input) : anthropicDraft(input);
}

/** Runs a question through the chosen provider with read-only tools (the compliance assistant). */
export async function runToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  assertConfigured();
  return env.ai.provider === "openai" ? openAiToolLoop(input) : anthropicToolLoop(input);
}


/** One analysis request whose JSON answer is checked against the schema (AI insights). */
export async function runStructured<T>(input: StructuredInput<T>): Promise<{ result: T; usage: AiUsage }> {
  assertConfigured();
  return env.ai.provider === "openai" ? openAiStructured(input) : anthropicStructured(input);
}
