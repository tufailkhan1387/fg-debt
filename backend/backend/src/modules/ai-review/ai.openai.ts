import OpenAI from "openai";
import * as z from "zod/v4";
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
  parseToolArgs,
  parseStructured,
  type StructuredInput,
  type AiUsage,
  type DraftInput,
  type JsonSchema,
  type ReviewInput,
  type ToolLoopInput,
  type ToolLoopResult,
} from "./ai.shared.js";

/** Created on first use so the server starts without an API key; the SDK reads OPENAI_API_KEY itself. */
let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI({ timeout: 10 * 60 * 1000, maxRetries: 2 });
  return client;
}


/** OpenAI's strict structured output needs every property listed as required and no extra properties. */
function strict(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = { ...schema };
  delete out.$schema;
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    const props = Object.fromEntries(Object.entries(out.properties as Record<string, JsonSchema>).map(([k, v]) => [k, strict(v)]));
    out.properties = props;
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  if (out.items && typeof out.items === "object") out.items = strict(out.items as JsonSchema);
  return out;
}

const REVIEW_JSON_SCHEMA = strict(z.toJSONSchema(ReviewSchema) as JsonSchema);

/** The firm's effort setting, as OpenAI reasoning models take it. */
function reasoning(): { reasoning?: { effort: "low" | "medium" | "high" } } {
  if (!/^(gpt-5|gpt-6|o\d)/.test(env.ai.model)) return {};
  const effort = env.ai.effort === "low" || env.ai.effort === "medium" ? env.ai.effort : "high";
  return { reasoning: { effort } };
}

function usageOf(response: OpenAI.Responses.Response): AiUsage {
  return {
    model: response.model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    // OpenAI caches long repeated prefixes by itself and reports what it read from the cache.
    cacheReadTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: 0,
  };
}

/** Refusals, truncation and content filtering come back as normal responses; turn them into errors. */
function assertFinished(response: OpenAI.Responses.Response) {
  const refused = response.output.some((item) => item.type === "message" && item.content.some((part) => part.type === "refusal"));
  if (refused || response.incomplete_details?.reason === "content_filter") throw AI_REFUSED();
  if (response.status === "incomplete" && response.incomplete_details?.reason === "max_output_tokens") throw AI_TOO_LONG();
  if (response.status !== "completed") throw new AppError("The AI did not finish. Try again.", 502, "AI_PROVIDER_ERROR");
}

export function describeOpenAiError(error: unknown): AppError | null {
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new AppError("The AI provider rejected the API key. Check the server settings.", 502, "AI_AUTH_FAILED");
  }
  if (error instanceof OpenAI.RateLimitError) {
    // OpenAI reports an empty account balance as a 429 too; that needs the firm to add credit, not a retry.
    if (error.code === "insufficient_quota" || error.type === "insufficient_quota" || error.code === "credit_balance_exhausted") {
      return new AppError("The AI provider account has no credit left. Add credit to the OpenAI account, then try again.", 402, "AI_NO_CREDIT");
    }
    return new AppError("The AI provider is busy. Try again in a minute.", 503, "AI_RATE_LIMITED");
  }
  if (error instanceof OpenAI.BadRequestError) return new AppError("The AI provider could not process this document.", 502, "AI_BAD_REQUEST");
  if (error instanceof OpenAI.APIConnectionError) return new AppError("Could not reach the AI provider. Check the internet connection.", 503, "AI_UNREACHABLE");
  if (error instanceof OpenAI.APIError) return new AppError("The AI provider returned an error. Try again later.", 502, "AI_PROVIDER_ERROR");
  return null;
}

function request(input: ReviewInput, task: string) {
  return {
    model: env.ai.model,
    instructions: SYSTEM_PROMPT,
    // The document comes first so the shared prefix can be reused between the review and the draft.
    input: [{ role: "user" as const, content: [{ type: "input_text" as const, text: documentText(input.documentType, input.fileName, input.text) }, { type: "input_text" as const, text: task }] }],
    max_output_tokens: 64000,
    store: false,
    ...reasoning(),
  };
}

export async function openAiReview(input: ReviewInput): Promise<{ review: AiReview; usage: AiUsage }> {
  const response = await openai().responses.create({
    ...request(input, reviewTask(input)),
    text: { format: { type: "json_schema", name: "compliance_review", schema: REVIEW_JSON_SCHEMA, strict: true } },
  });
  assertFinished(response);
  return { review: parseReview(response.output_text), usage: usageOf(response) };
}

export async function openAiDraft(input: DraftInput): Promise<{ text: string; usage: AiUsage }> {
  const response = await openai().responses.create(request(input, draftTask(input)));
  assertFinished(response);
  const text = response.output_text.trim();
  if (!text) throw AI_EMPTY_DRAFT();
  return { text, usage: usageOf(response) };
}

/**
 * The assistant's tool loop. Nothing is stored at OpenAI (store: false), so each round sends the whole exchange
 * back, including the model's encrypted reasoning, as the Responses API requires.
 */
export async function openAiToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  const reason = reasoning();
  const tools = input.tools.map((t) => ({ type: "function" as const, name: t.name, description: t.description, parameters: strict(t.parameters), strict: true }));
  let items: OpenAI.Responses.ResponseInputItem[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.text }) as OpenAI.Responses.ResponseInputItem),
    { role: "user", content: input.question },
  ];
  const usage: AiUsage[] = [];
  let toolCalls = 0;
  for (let round = 0; ; round++) {
    const last = round >= input.maxRounds;
    const response = await openai().responses.create({
      model: env.ai.model,
      instructions: input.system,
      input: items,
      tools,
      // After the last round the model must answer with what it has gathered.
      tool_choice: last ? "none" : "auto",
      max_output_tokens: 16000,
      store: false,
      ...(reason.reasoning ? { ...reason, include: ["reasoning.encrypted_content" as const] } : {}),
    });
    usage.push(usageOf(response));
    assertFinished(response);
    const calls = response.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call");
    if (!calls.length || last) return { text: response.output_text.trim(), usage, toolCalls };
    toolCalls += calls.length;
    const results = await Promise.all(
      calls.map(async (c) => ({ type: "function_call_output" as const, call_id: c.call_id, output: await input.execute(c.name, parseToolArgs(c.arguments)) })),
    );
    items = [...items, ...(response.output as OpenAI.Responses.ResponseInputItem[]), ...results];
  }
}


export async function openAiStructured<T>(input: StructuredInput<T>): Promise<{ result: T; usage: AiUsage }> {
  const response = await openai().responses.create({
    model: env.ai.model,
    instructions: input.system,
    input: [{ role: "user", content: input.prompt }],
    max_output_tokens: 32000,
    store: false,
    ...reasoning(),
    text: { format: { type: "json_schema", name: input.name, schema: strict(z.toJSONSchema(input.schema) as JsonSchema), strict: true } },
  });
  assertFinished(response);
  return { result: parseStructured(response.output_text, input.schema), usage: usageOf(response) };
}
