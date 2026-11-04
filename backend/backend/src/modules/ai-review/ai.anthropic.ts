import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/appError.js";
import {
  AI_EMPTY_DRAFT,
  AI_REFUSED,
  AI_TOO_LONG,
  documentText,
  draftTask,
  parseReview,
  ReviewSchema,
  reviewTask,
  SYSTEM_PROMPT,
  type AiReview,
  type AiUsage,
  type DraftInput,
  type ReviewInput,
  parseStructured,
  type StructuredInput,
  type ToolLoopInput,
  type ToolLoopResult,
} from "./ai.shared.js";

/** Created on first use so the server starts without an API key; the SDK reads ANTHROPIC_API_KEY itself. */
let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

// Schema only, without the SDK's auto-parse hook: a refusal returns empty text, which must be reported as a
// refusal rather than fail inside the SDK as invalid JSON. The JSON is validated after the stop reason.
const { type: reviewFormatType, schema: reviewFormatSchema } = betaZodOutputFormat(ReviewSchema);
const REVIEW_FORMAT = { type: reviewFormatType, schema: reviewFormatSchema };

function documentBlock(input: ReviewInput): Anthropic.Beta.BetaTextBlockParam {
  return { type: "text", text: documentText(input.documentType, input.fileName, input.text), cache_control: { type: "ephemeral" } };
}

function usageOf(message: Anthropic.Beta.BetaMessage): AiUsage {
  return {
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/** Refusals and truncation come back as normal responses; turn them into errors the user can act on. */
function assertFinished(message: Anthropic.Beta.BetaMessage) {
  if (message.stop_reason === "refusal") throw AI_REFUSED();
  if (message.stop_reason === "max_tokens") throw AI_TOO_LONG();
}

export function describeAnthropicError(error: unknown): AppError | null {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AppError("The AI provider rejected the API key. Check the server settings.", 502, "AI_AUTH_FAILED");
  }
  if (error instanceof Anthropic.RateLimitError) return new AppError("The AI provider is busy. Try again in a minute.", 503, "AI_RATE_LIMITED");
  if (error instanceof Anthropic.BadRequestError) return new AppError("The AI provider could not process this document.", 502, "AI_BAD_REQUEST");
  if (error instanceof Anthropic.APIConnectionError) return new AppError("Could not reach the AI provider. Check the internet connection.", 503, "AI_UNREACHABLE");
  if (error instanceof Anthropic.APIError) return new AppError("The AI provider returned an error. Try again later.", 502, "AI_PROVIDER_ERROR");
  return null;
}

export async function anthropicReview(input: ReviewInput): Promise<{ review: AiReview; usage: AiUsage }> {
  // Streaming avoids HTTP timeouts on long documents.
  const message = await anthropic()
    .beta.messages.stream({
      model: env.ai.model,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: env.ai.effort, format: REVIEW_FORMAT },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [documentBlock(input), { type: "text", text: reviewTask(input) }] }],
    })
    .finalMessage();
  assertFinished(message);
  return { review: parseReview(textOf(message)), usage: usageOf(message) };
}

export async function anthropicDraft(input: DraftInput): Promise<{ text: string; usage: AiUsage }> {
  const message = await anthropic()
    .beta.messages.stream({
      model: env.ai.model,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: env.ai.effort },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [documentBlock(input), { type: "text", text: draftTask(input) }] }],
    })
    .finalMessage();
  assertFinished(message);
  const text = textOf(message).trim();
  if (!text) throw AI_EMPTY_DRAFT();
  return { text, usage: usageOf(message) };
}

/** The assistant's tool loop: the model asks for tools until it answers or runs out of rounds. */
export async function anthropicToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  const tools = input.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: input.question },
  ];
  const usage: AiUsage[] = [];
  let toolCalls = 0;
  for (let round = 0; ; round++) {
    const last = round >= input.maxRounds;
    const message = await anthropic()
      .beta.messages.stream({
        model: env.ai.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: env.ai.effort },
        system: input.system,
        tools,
        // After the last round the model must answer with what it has gathered.
        tool_choice: last ? { type: "none" } : { type: "auto" },
        messages,
      })
      .finalMessage();
    usage.push(usageOf(message));
    assertFinished(message);
    const uses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || !uses.length || last) return { text: textOf(message).trim(), usage, toolCalls };
    toolCalls += uses.length;
    messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({
      role: "user",
      content: await Promise.all(uses.map(async (u) => ({ type: "tool_result" as const, tool_use_id: u.id, content: await input.execute(u.name, (u.input ?? {}) as Record<string, unknown>) }))),
    });
  }
}


export async function anthropicStructured<T>(input: StructuredInput<T>): Promise<{ result: T; usage: AiUsage }> {
  const { type, schema } = betaZodOutputFormat(input.schema as never);
  const message = await anthropic()
    .beta.messages.stream({
      model: env.ai.model,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: env.ai.effort, format: { type, schema } },
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    })
    .finalMessage();
  assertFinished(message);
  return { result: parseStructured(textOf(message), input.schema), usage: usageOf(message) };
}
