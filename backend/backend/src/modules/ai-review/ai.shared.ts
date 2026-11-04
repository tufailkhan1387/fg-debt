import * as z from "zod/v4";
import { AppError } from "../../middleware/appError.js";

/** What every provider must return for a review; checked after the response arrives. */
export const ReviewSchema = z.object({
  summary: z.string(),
  criteria: z.array(
    z.object({
      criterionId: z.string(),
      verdict: z.enum(["covered", "partly_covered", "not_covered", "unclear"]),
      quotes: z.array(z.string()),
      explanation: z.string(),
      recommendedAction: z.string(),
    }),
  ),
  compliant: z.array(z.string()),
  missing: z.array(z.string()),
  improvements: z.array(z.string()),
  actions: z.array(z.object({ action: z.string(), priority: z.enum(["high", "medium", "low"]) })),
  generalObservations: z.array(z.object({ observation: z.string(), basis: z.enum(["document", "general_practice"]) })),
});
export type AiReview = z.infer<typeof ReviewSchema>;

export interface ReviewCriterion {
  id: string;
  label: string;
  text: string;
}

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ReviewInput {
  documentType: string;
  fileName: string;
  text: string;
  criteria: ReviewCriterion[];
}

export interface DraftInput extends ReviewInput {
  review: AiReview;
}

// Shared by review and draft requests so the system prompt + document prefix can be cached between them.
export const SYSTEM_PROMPT = `You review compliance documents for Frantz Gregory & Co, a solicitors' practice in England and Wales regulated by the SRA and working towards the Specialist Quality Mark (SQM). Your work assists the firm's Principal, who makes every final decision; it is not a regulatory determination.

How to work:
- Base findings on the document text you are given. When you say the document covers something, copy the exact supporting words from the document into quotes (short, verbatim). Quotes are checked against the document automatically and any that do not appear are flagged.
- If something required is absent, say it is missing. Never assume a procedure exists because it would be usual.
- When criteria are supplied, assess each one exactly once using its id, and do not create other ids.
- Points that come from your own knowledge of regulation or good practice, rather than from the supplied criteria or the document, belong in generalObservations with basis "general_practice"; the firm treats these as unverified.
- Text such as [EMAIL REDACTED] or [PHONE REDACTED] marks a detail removed before the document was sent. Treat it as present in the original document, but say you could not check its accuracy where that matters.
- Write in plain British English for a busy Principal.`;

export function documentText(documentType: string, fileName: string, text: string): string {
  return `Document type: ${documentType}\nFile name: ${fileName}\n\n<document>\n${text}\n</document>`;
}

export function reviewTask(input: ReviewInput): string {
  return input.criteria.length
    ? `Check the document against these criteria. Assess every one, using its id as criterionId.\n\n${input.criteria
        .map((c) => `<criterion id="${c.id}" label="${c.label}">\n${c.text}\n</criterion>`)
        .join("\n")}\n\nThen summarise what is compliant, what may be missing, what needs improvement and the actions the firm should take.`
    : `No specific criteria were supplied. Review the document for completeness and quality as a ${input.documentType} for this firm. Leave criteria empty; put every point in generalObservations (basis "document" when it is about what the text says or omits, "general_practice" when it relies on your own knowledge), then summarise what is compliant, what may be missing, what needs improvement and the actions to take.`;
}

export function draftTask(input: DraftInput): string {
  const findings = {
    criteria: input.review.criteria.map((c) => ({
      criterion: input.criteria.find((k) => k.id === c.criterionId)?.label ?? c.criterionId,
      verdict: c.verdict,
      recommendedAction: c.recommendedAction,
    })),
    missing: input.review.missing,
    improvements: input.review.improvements,
    actions: input.review.actions,
  };
  return `Prepare a revised version of this document that deals with these review findings:\n\n${JSON.stringify(findings, null, 2)}\n\nKeep the firm's structure and wording wherever it is already adequate. Do not invent facts about the firm (names, dates, contacts, systems); where the firm must supply something, write [TO BE COMPLETED: what is needed]. The draft goes to the Principal for approval before it takes effect.\n\nReturn only the revised document text. Mark headings with "# " (main) or "## " (sub), list items with "- ", and leave a blank line between paragraphs.`;
}

/** Checks the provider's JSON against the review schema. */
export function parseReview(text: string): AiReview {
  let json: unknown = null;
  try {
    json = JSON.parse(text || "null");
  } catch {
    // Reported below as an unexpected format.
  }
  const parsed = ReviewSchema.safeParse(json);
  if (!parsed.success) throw new AppError("The AI returned a review in an unexpected format. Try again.", 502, "AI_BAD_OUTPUT");
  return parsed.data;
}

export const AI_REFUSED = () => new AppError("The AI declined to review this document. Try again, or review it manually.", 422, "AI_REFUSED");
export const AI_TOO_LONG = () => new AppError("The AI response was cut off because the document is very long. Split it into smaller parts.", 422, "AI_OUTPUT_TOO_LONG");
export const AI_EMPTY_DRAFT = () => new AppError("The AI returned an empty draft. Try again.", 502, "AI_BAD_OUTPUT");

// --- Tool use (the compliance assistant): the AI asks for records through read-only tools until it can answer.

export type JsonSchema = { [key: string]: unknown };

export interface AiTool {
  name: string;
  description: string;
  /** JSON schema of an object; every property listed in `required` (use a null type for optional ones). */
  parameters: JsonSchema;
}

export interface ToolLoopInput {
  system: string;
  /** Earlier turns of the conversation, oldest first. */
  history: Array<{ role: "user" | "assistant"; text: string }>;
  question: string;
  tools: AiTool[];
  /** Runs one tool call and returns its result as text for the AI. */
  execute: (name: string, args: Record<string, unknown>) => Promise<string>;
  /** Tool rounds before the AI must answer with what it has. */
  maxRounds: number;
}

export interface ToolLoopResult {
  text: string;
  usage: AiUsage[];
  toolCalls: number;
}

/** Tool arguments arrive as JSON text; anything unreadable becomes an empty object. */
export function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw ?? "{}"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// --- Structured analysis (AI insights): one request, a JSON answer checked against a schema.

export interface StructuredInput<T> {
  system: string;
  /** The task and the records it is about, as one user message. */
  prompt: string;
  /** A short identifier for the output format, e.g. "compliance_insight". */
  name: string;
  schema: z.ZodType<T>;
}

/** Checks the provider's JSON against the requested schema. */
export function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  let json: unknown = null;
  try {
    json = JSON.parse(text || "null");
  } catch {
    // Reported below as an unexpected format.
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AppError("The AI returned its analysis in an unexpected format. Try again.", 502, "AI_BAD_OUTPUT");
  return parsed.data;
}
