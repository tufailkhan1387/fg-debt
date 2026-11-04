import * as z from "zod/v4";
import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { redactPersonalData } from "../../utils/redact.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { AI_PROVIDER, describeAiError, runStructured } from "../ai-review/ai.client.js";
import { SourceRegistry, type AssistantActor, type SourceRef } from "../compliance-assistant/assistant.tools.js";
import { INSIGHT_KINDS, insightKind, type InsightKey } from "./insights.kinds.js";

/** What every analysis returns; refs are the record references ([P3] …) the records gave. */
export const InsightSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["high", "medium", "low"]),
      refs: z.array(z.string()),
      basis: z.enum(["records", "general_practice"]),
    }),
  ),
  recommendations: z.array(
    z.object({
      action: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      refs: z.array(z.string()),
      basis: z.enum(["records", "general_practice"]),
    }),
  ),
  missingInformation: z.array(z.string()),
});
export type Insight = z.infer<typeof InsightSchema>;

const SYSTEM_PROMPT = `You analyse the compliance records of Frantz Gregory & Co, a solicitors' practice in England and Wales regulated by the SRA and working towards the Specialist Quality Mark (SQM). Your analysis assists the firm's Principal, who makes every decision. Today is {{TODAY}}.

How to work:
- Work only from the records supplied in <records> blocks (and the update in <update>, when there is one). Each record has a reference such as "P3" or "G12" in its "ref" field.
- In refs, list the references of the records each finding or recommendation relies on, exactly as given (e.g. "P3"). Use only references that appear in the records. You may also cite them in text as [P3].
- Mark a finding or recommendation basis "general_practice" when it comes from your own knowledge of regulation or good practice rather than the records; the firm treats those as unverified. Never present them as the firm's position or as verified legal fact.
- If the records do not show something you would need, say so in missingInformation. Never assume a procedure, policy or record exists.
- Never say the firm is compliant or certified. Describe what the records show and what is outstanding.
- Text such as [EMAIL REDACTED] marks personal details removed before the records were sent. Restricted records (for example some complaints, data breaches, safeguarding) are never included; the records say how many were left out.
- Write in plain British English for a busy Principal. Keep each finding and recommendation short and specific; put the most important first.`;

interface InsightRow {
  id: string;
  kind: InsightKey;
  title: string;
  input_text: string | null;
  result: Insight;
  sources: SourceRef[];
  unknown_refs: string[];
  usage: unknown;
  created_by_email: string | null;
  created_at: Date;
}

const SELECT = `SELECT i.*, u.email AS created_by_email FROM compliance_ai_insights i LEFT JOIN users u ON u.id = i.created_by`;

function toInsight(row: InsightRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    inputText: row.input_text,
    result: row.result,
    sources: row.sources,
    unknownRefs: row.unknown_refs,
    createdBy: row.created_by_email,
    createdAt: row.created_at.toISOString(),
  };
}

function log(actor: AssistantActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "ai_insight", entityId, details, ip: actor.ip ?? null });
}

/** References the AI used, checked against the records it was actually given. */
function checkRefs(result: Insight, sources: SourceRegistry) {
  const cited = new Set<string>();
  const add = (ref: string) => cited.add(ref.replace(/[[\]\s]/g, "").toUpperCase());
  const scan = (text: string) => [...text.matchAll(/\[([A-Z]\d{1,4})\]/g)].forEach((m) => add(m[1]!));
  scan(result.summary);
  for (const item of [...result.findings, ...result.recommendations]) {
    item.refs.forEach(add);
    scan("detail" in item ? `${item.title} ${item.detail}` : item.action);
  }
  const known = [...cited].map((ref) => sources.get(ref)).filter((s): s is NonNullable<typeof s> => !!s);
  return {
    sources: known.map(({ ref, kind, label, link }) => ({ ref, kind, label, link })),
    unknownRefs: [...cited].filter((ref) => !sources.get(ref)),
  };
}

export const insightsService = {
  async overview() {
    const latest = (await query<InsightRow>(`${SELECT} WHERE i.id IN (SELECT DISTINCT ON (kind) id FROM compliance_ai_insights ORDER BY kind, created_at DESC)`)).rows;
    const history = (
      await query<{ id: string; kind: InsightKey; title: string; created_at: Date }>("SELECT id, kind, title, created_at FROM compliance_ai_insights ORDER BY created_at DESC LIMIT 50")
    ).rows;
    return {
      status: { configured: env.ai.configured, provider: AI_PROVIDER, model: env.ai.model },
      kinds: INSIGHT_KINDS.map(({ key, title, description, spec, needsText }) => {
        const last = latest.find((r) => r.kind === key);
        return { key, title, description, spec, needsText: !!needsText, latest: last ? toInsight(last) : null };
      }),
      history: history.map((h) => ({ id: h.id, kind: h.kind, title: h.title, createdAt: h.created_at.toISOString() })),
    };
  },

  async get(id: string) {
    const row = (await query<InsightRow>(`${SELECT} WHERE i.id = $1`, [id])).rows[0];
    if (!row) throw new AppError("Analysis not found.", 404, "INSIGHT_NOT_FOUND");
    return toInsight(row);
  },

  /** The most recent analysis of a kind, for the dashboard and reports. */
  async latest(kind: InsightKey) {
    const row = (await query<InsightRow>(`${SELECT} WHERE i.kind = $1 ORDER BY i.created_at DESC LIMIT 1`, [kind])).rows[0];
    return row ? toInsight(row) : null;
  },

  async run(key: string, input: { title?: string | undefined; text?: string | undefined }, actor: AssistantActor) {
    const kind = insightKind(key);
    if (!kind) throw new AppError("Unknown analysis.", 404, "INSIGHT_NOT_FOUND");
    if (!env.ai.configured) throw new AppError("AI analysis is not set up yet. Add the AI provider's API key to the server settings.", 503, "AI_NOT_CONFIGURED");
    const text = input.text?.trim() ?? "";
    if (kind.needsText && text.length < 50) throw new AppError("Paste the text of the regulatory update (at least a few sentences).", 400, "VALIDATION_ERROR");

    const sources = new SourceRegistry();
    const gathered = await kind.gather({ actor, sources });
    const update = kind.needsText ? `<update title="${(input.title ?? "").replace(/"/g, "'")}">\n${redactPersonalData(text).text}\n</update>\n\n` : "";
    const title = kind.needsText && input.title?.trim() ? `${kind.title}: ${input.title.trim()}`.slice(0, 200) : kind.title;

    let response;
    try {
      response = await runStructured({
        system: SYSTEM_PROMPT.replace("{{TODAY}}", new Date().toISOString().slice(0, 10)),
        prompt: `${kind.task}\n\n${update}${gathered}`,
        name: "compliance_insight",
        schema: InsightSchema,
      });
    } catch (error) {
      const e = describeAiError(error);
      await log(actor, "ai_insight.failed", kind.key, { code: e.code });
      throw e;
    }

    const checked = checkRefs(response.result, sources);
    const row = (
      await query<{ id: string }>(
        "INSERT INTO compliance_ai_insights (kind, title, input_text, result, sources, unknown_refs, usage, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [kind.key, title, kind.needsText ? text : null, JSON.stringify(response.result), JSON.stringify(checked.sources), JSON.stringify(checked.unknownRefs), JSON.stringify(response.usage), actor.userId],
      )
    ).rows[0]!;
    await log(actor, "ai_insight.generated", row.id, { kind: kind.key, model: env.ai.model, provider: AI_PROVIDER, cited: checked.sources.length, unknownRefs: checked.unknownRefs.length });
    return this.get(row.id);
  },

  async remove(id: string, actor: AssistantActor) {
    const { rowCount } = await query("DELETE FROM compliance_ai_insights WHERE id = $1", [id]);
    if (!rowCount) throw new AppError("Analysis not found.", 404, "INSIGHT_NOT_FOUND");
    await log(actor, "ai_insight.deleted", id);
  },
};
