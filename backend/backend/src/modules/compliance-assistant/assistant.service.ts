import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { AI_PROVIDER, describeAiError, runToolLoop } from "../ai-review/ai.client.js";
import { ASSISTANT_TOOLS, runAssistantTool, SourceRegistry, type AssistantActor, type SourceRef } from "./assistant.tools.js";

/** How many earlier turns go back to the AI with a new question. */
const HISTORY_TURNS = 10;
const MAX_TOOL_ROUNDS = 8;

// {{TODAY}} is filled in for each question.
const SYSTEM_PROMPT = `You are the compliance assistant for Frantz Gregory & Co, a solicitors' practice in England and Wales regulated by the SRA and working towards the Specialist Quality Mark (SQM). You answer the Principal's questions using the firm's own compliance records, which you read through the tools. You assist; the Principal decides. Today is {{TODAY}}.

How to answer:
- Look things up with the tools before answering. Do not answer from memory about the firm.
- Every statement about the firm's records must cite the record it comes from, using the reference the tool gave, in square brackets, e.g. "The complaints policy is due for review [P2]." Only use references that a tool returned in this conversation.
- If the records do not show something, say so plainly. End every answer with a short section headed "Information missing" listing what you could not find or check (write "None" if nothing).
- Points from your own general knowledge of regulation or good practice (not from the firm's records) must be marked "(general knowledge, not verified)". Never present them as the firm's position or as verified legal fact.
- Never say the firm is compliant or certified. Describe what the records show and what is outstanding.
- You cannot create, change, approve or send anything. For requests to prepare a report or evidence pack, use reports_and_packs and tell the Principal where to produce it, then summarise what it will contain from the records.
- You have no live feed of regulatory changes. If asked about them, say that, give only clearly marked general knowledge, and suggest checking the SRA and SQM sources.
- Text such as [EMAIL REDACTED] marks personal details removed before records were sent to you. Restricted records (for example some complaints, data breaches, safeguarding) are never shown to you; say so if they may matter.
- Write in plain British English for a busy Principal: short paragraphs or bullet points, most important first.`;

interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Array<SourceRef & { cited: boolean }>;
  unknown_refs: string[];
  created_at: Date;
}

function toMessage(row: MessageRow) {
  return { id: row.id, role: row.role, content: row.content, sources: row.sources, unknownRefs: row.unknown_refs, createdAt: row.created_at.toISOString() };
}

async function ownConversation(id: string, actor: AssistantActor) {
  const row = (await query<{ id: string; title: string }>("SELECT id, title FROM compliance_assistant_conversations WHERE id = $1 AND user_id = $2", [id, actor.userId])).rows[0];
  if (!row) throw new AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  return row;
}

function log(actor: AssistantActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "assistant", entityId, details, ip: actor.ip ?? null });
}

export const assistantService = {
  status() {
    return { configured: env.ai.configured, provider: AI_PROVIDER, model: env.ai.model };
  },

  async conversations(actor: AssistantActor) {
    return (
      await query<{ id: string; title: string; updated_at: Date }>(
        "SELECT id, title, updated_at FROM compliance_assistant_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100",
        [actor.userId],
      )
    ).rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at.toISOString() }));
  },

  async conversation(id: string, actor: AssistantActor) {
    const c = await ownConversation(id, actor);
    const messages = (await query<MessageRow>("SELECT * FROM compliance_assistant_messages WHERE conversation_id = $1 ORDER BY created_at, id", [id])).rows;
    return { id: c.id, title: c.title, messages: messages.map(toMessage) };
  },

  async remove(id: string, actor: AssistantActor) {
    await ownConversation(id, actor);
    await query("DELETE FROM compliance_assistant_conversations WHERE id = $1", [id]);
    await log(actor, "assistant.conversation_deleted", id);
  },

  /**
   * Answers a question with the firm's records: the AI reads them through read-only tools, then each reference it
   * cites is checked against the records it was actually shown.
   */
  async ask(input: { conversationId: string | null; question: string }, actor: AssistantActor) {
    if (!env.ai.configured) throw new AppError("The AI assistant is not set up yet. Add the AI provider's API key to the server settings.", 503, "AI_NOT_CONFIGURED");

    const conversationId =
      input.conversationId ??
      (await query<{ id: string }>("INSERT INTO compliance_assistant_conversations (user_id, title) VALUES ($1, $2) RETURNING id", [actor.userId, input.question.slice(0, 120)])).rows[0]!.id;
    if (input.conversationId) await ownConversation(input.conversationId, actor);

    const earlier = (
      await query<{ role: "user" | "assistant"; content: string }>(
        "SELECT role, content FROM (SELECT role, content, created_at, id FROM compliance_assistant_messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2) t ORDER BY created_at, id",
        [conversationId, HISTORY_TURNS * 2],
      )
    ).rows;
    const asked = (await query<{ id: string }>("INSERT INTO compliance_assistant_messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING id", [conversationId, input.question])).rows[0]!.id;

    // References are numbered afresh for each answer; earlier answers keep their own stored links.
    const sources = new SourceRegistry();
    let result;
    try {
      result = await runToolLoop({
        system: SYSTEM_PROMPT.replace("{{TODAY}}", new Date().toISOString().slice(0, 10)),
        history: earlier.map((m) => ({ role: m.role, text: m.content })),
        question: input.question,
        tools: ASSISTANT_TOOLS,
        execute: (name, args) => runAssistantTool(name, args, actor, sources).catch((error: unknown) => JSON.stringify({ error: error instanceof Error ? error.message : "The tool failed." })),
        maxRounds: MAX_TOOL_ROUNDS,
      });
    } catch (error) {
      const e = describeAiError(error);
      // An unanswered question is not kept: the person can ask it again (the page puts it back in the box).
      if (input.conversationId) await query("DELETE FROM compliance_assistant_messages WHERE id = $1", [asked]);
      else await query("DELETE FROM compliance_assistant_conversations WHERE id = $1", [conversationId]);
      await log(actor, "assistant.failed", conversationId, { code: e.code });
      throw e;
    }

    const cited = [...new Set([...result.text.matchAll(/\[([A-Z]\d{1,4})\]/g)].map((m) => m[1]!))];
    const known = cited.map((ref) => sources.get(ref)).filter((s): s is NonNullable<typeof s> => !!s);
    const unknownRefs = cited.filter((ref) => !sources.get(ref));
    const sourceList = known.map(({ ref, kind, label, link }) => ({ ref, kind, label, link, cited: true }));

    const saved = (
      await query<MessageRow>(
        "INSERT INTO compliance_assistant_messages (conversation_id, role, content, sources, unknown_refs, usage) VALUES ($1, 'assistant', $2, $3, $4, $5) RETURNING *",
        [conversationId, result.text || "(The assistant gave no answer. Try asking again.)", JSON.stringify(sourceList), JSON.stringify(unknownRefs), JSON.stringify(result.usage)],
      )
    ).rows[0]!;
    await query("UPDATE compliance_assistant_conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);
    // The question and answer stay out of the log; only that one was asked and what was used.
    await log(actor, "assistant.asked", conversationId, { model: env.ai.model, provider: AI_PROVIDER, toolCalls: result.toolCalls, cited: sourceList.length, unknownRefs: unknownRefs.length });
    return { conversationId, message: toMessage(saved) };
  },
};
