import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { documentText } from "../../utils/document-text.js";
import { draftToDocx } from "../../utils/draft-docx.js";
import { readEncryptedFile, removeStoredFiles, storeEncryptedFile } from "../../utils/encrypted-store.js";
import { redactPersonalData } from "../../utils/redact.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { hasAccess } from "../compliance-access/access.helpers.js";
import type { PermissionMap } from "../compliance-access/access.types.js";
import { policyLibraryService } from "../policy-library/policy-library.service.js";
import { AI_PROVIDER, describeAiError, runDraft, runReview } from "./ai.client.js";
import {
  MAX_DOCUMENT_CHARS,
  type ReviewDetail,
  type ReviewListItem,
  type ReviewRow,
  type StoredCriterion,
  type StoredReview,
} from "./ai-review.types.js";
import type { CreateReviewInput } from "./ai-review.validators.js";

export interface ReviewActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  permissions: PermissionMap;
  ip?: string | null;
}

interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

const UPLOAD_FOLDER = "compliance-ai-documents";
const DRAFT_NOTE = "DRAFT prepared with AI assistance — not in force until approved by the Principal.";

function log(actor: { userId: string | null; email: string; ip?: string | null }, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "ai_review", entityId, details, ip: actor.ip ?? null });
}

/** Same comparison for quotes and document: case, spacing, curly quotes and dashes ignored. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function toListItem(row: ReviewRow): ReviewListItem {
  return {
    id: row.id,
    source: row.source,
    policyId: row.policy_id,
    documentType: row.document_type,
    fileName: row.file_name,
    criteriaCount: row.criteria.length,
    status: row.status,
    notCovered: row.result ? row.result.criteria.filter((c) => c.verdict === "not_covered").length : null,
    actions: row.result ? row.result.actions.length : null,
    requestedBy: row.requested_by,
    createdAt: row.created_at.toISOString(),
  };
}

function toDetail(row: ReviewRow): ReviewDetail {
  return {
    ...toListItem(row),
    policyVersionId: row.policy_version_id,
    criteria: row.criteria,
    redacted: row.redacted,
    redactions: row.redactions,
    result: row.result,
    error: row.error,
    provider: row.provider,
    model: row.model,
    inputChars: row.input_chars,
    usage: row.usage,
    draftStatus: row.draft_status,
    draftText: row.draft_text,
    draftError: row.draft_error,
    draftGeneratedAt: row.draft_generated_at ? row.draft_generated_at.toISOString() : null,
    draftSubmittedVersionId: row.draft_submitted_version_id,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

async function getRow(id: string): Promise<ReviewRow> {
  const row = (await query<ReviewRow>("SELECT * FROM compliance_ai_reviews WHERE id = $1", [id])).rows[0];
  if (!row) throw new AppError("Review not found.", 404, "AI_REVIEW_NOT_FOUND");
  return row;
}

/** The text actually sent to the AI: the document, with personal data removed when the review asked for it. */
async function preparedText(row: Pick<ReviewRow, "source" | "storage_path" | "sha256" | "policy_version_id" | "file_name" | "redacted">) {
  let buffer: Buffer;
  if (row.source === "upload") {
    if (!row.storage_path || !row.sha256) throw new AppError("The uploaded document is missing.", 410, "AI_DOCUMENT_MISSING");
    buffer = await readEncryptedFile(row.storage_path, row.sha256);
  } else {
    const version = (
      await query<{ storage_path: string; sha256: string }>(
        "SELECT storage_path, sha256 FROM compliance_policy_versions WHERE id = $1",
        [row.policy_version_id],
      )
    ).rows[0];
    if (!version) throw new AppError("That policy version no longer exists.", 410, "AI_DOCUMENT_MISSING");
    buffer = await readEncryptedFile(version.storage_path, version.sha256);
  }
  const text = await documentText(buffer, row.file_name);
  return row.redacted ? redactPersonalData(text) : { text, counts: {}, total: 0 };
}

async function buildCriteria(input: CreateReviewInput): Promise<StoredCriterion[]> {
  const criteria: StoredCriterion[] = [];
  if (input.sqmRequirementIds.length) {
    const rows = (
      await query<{ id: string; ref: string; requirement: string; meaning: string }>(
        "SELECT id, ref, requirement, meaning FROM compliance_sqm_requirements WHERE id = ANY($1::uuid[]) ORDER BY section, ref",
        [input.sqmRequirementIds],
      )
    ).rows;
    if (rows.length !== new Set(input.sqmRequirementIds).size) {
      throw new AppError("One of the chosen SQM requirements no longer exists.", 400, "SQM_REQUIREMENT_NOT_FOUND");
    }
    for (const r of rows) {
      criteria.push({
        id: `SQM-${r.ref}`,
        kind: "sqm",
        requirementId: r.id,
        label: `SQM ${r.ref}`,
        text: r.meaning ? `${r.requirement}\n(What it means: ${r.meaning})` : r.requirement,
      });
    }
  }
  input.customCriteria.forEach((text, i) => {
    criteria.push({ id: `C${i + 1}`, kind: "custom", label: `Check ${i + 1}`, text });
  });
  return criteria;
}

/** Runs the AI review in the background and stores the outcome; never throws. */
async function processReview(id: string, actor: ReviewActor) {
  try {
    const row = await getRow(id);
    await query("UPDATE compliance_ai_reviews SET status = 'running' WHERE id = $1", [id]);
    const prepared = await preparedText(row);
    const { review, usage } = await runReview({
      documentType: row.document_type,
      fileName: row.file_name,
      text: prepared.text,
      criteria: row.criteria,
    });

    // The AI was told its quotes are checked: confirm each one really appears in the text it was given.
    const haystack = normalise(prepared.text);
    const known = new Set(row.criteria.map((c) => c.id));
    const result: StoredReview = {
      ...review,
      criteria: review.criteria
        .filter((c) => known.has(c.criterionId))
        .map((c) => ({ ...c, quoteChecks: c.quotes.map((q) => ({ quote: q, found: haystack.includes(normalise(q)) })) })),
    };

    await query(
      `UPDATE compliance_ai_reviews SET status = 'completed', result = $2, usage = $3, model = $4, completed_at = NOW()
       WHERE id = $1`,
      [id, JSON.stringify(result), JSON.stringify([usage]), usage.model],
    );
    const unverified = result.criteria.flatMap((c) => c.quoteChecks).filter((q) => !q.found).length;
    await log(actor, "ai.review_completed", row.file_name, {
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      unverifiedQuotes: unverified,
    });
  } catch (error) {
    const appError = describeAiError(error);
    await query("UPDATE compliance_ai_reviews SET status = 'failed', error = $2, completed_at = NOW() WHERE id = $1", [id, appError.message]).catch(() => {});
    await log(actor, "ai.review_failed", id, { code: appError.code, error: appError.message }).catch(() => {});
  }
}

async function processDraft(id: string, actor: ReviewActor) {
  try {
    const row = await getRow(id);
    if (!row.result) throw new AppError("The review has no results to work from.", 400, "AI_REVIEW_NOT_READY");
    const prepared = await preparedText(row);
    const { text, usage } = await runDraft({
      documentType: row.document_type,
      fileName: row.file_name,
      text: prepared.text,
      review: row.result,
      criteria: row.criteria,
    });
    await query(
      `UPDATE compliance_ai_reviews SET draft_status = 'completed', draft_text = $2, draft_error = NULL,
         draft_generated_at = NOW(), usage = COALESCE(usage, '[]'::jsonb) || $3::jsonb
       WHERE id = $1`,
      [id, text, JSON.stringify([usage])],
    );
    await log(actor, "ai.draft_generated", row.file_name, { model: usage.model, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens });
  } catch (error) {
    const appError = describeAiError(error);
    await query("UPDATE compliance_ai_reviews SET draft_status = 'failed', draft_error = $2 WHERE id = $1", [id, appError.message]).catch(() => {});
    await log(actor, "ai.draft_failed", id, { code: appError.code, error: appError.message }).catch(() => {});
  }
}

export const aiReviewService = {
  status() {
    return { configured: env.ai.configured, provider: AI_PROVIDER, model: env.ai.model };
  },

  async list(): Promise<ReviewListItem[]> {
    const rows = (await query<ReviewRow>("SELECT * FROM compliance_ai_reviews ORDER BY created_at DESC LIMIT 200")).rows;
    return rows.map(toListItem);
  },

  async get(id: string): Promise<ReviewDetail> {
    return toDetail(await getRow(id));
  },

  /**
   * Checks the document can be read, records the review and starts it in the background.
   * The caller polls get() for the outcome.
   */
  async create(input: CreateReviewInput, file: UploadedFile | undefined, actor: ReviewActor): Promise<ReviewDetail> {
    if (!env.ai.configured) {
      throw new AppError("AI review is not set up yet. Add the AI provider's API key to the server settings.", 503, "AI_NOT_CONFIGURED");
    }

    let fileName: string;
    let buffer: Buffer;
    let policyId: string | null = null;
    let policyVersionId: string | null = null;
    if (input.source === "upload") {
      if (!file) throw new AppError("Attach the document to review.", 400, "FILE_REQUIRED");
      fileName = file.originalname;
      buffer = file.buffer;
    } else {
      if (!hasAccess(actor.permissions, "policies", "view")) {
        throw new AppError("You do not have access to the Policy Library.", 403, "FORBIDDEN");
      }
      // The version in force, or the one awaiting approval when nothing is in force yet.
      const version = (
        await query<{ id: string; policy_id: string; file_name: string; storage_path: string; sha256: string }>(
          `SELECT v.id, v.policy_id, v.file_name, v.storage_path, v.sha256
           FROM compliance_policy_versions v JOIN compliance_policies p ON p.id = v.policy_id
           WHERE v.policy_id = $1 AND (v.id = p.current_version_id OR (p.current_version_id IS NULL AND v.status = 'pending'))
           LIMIT 1`,
          [input.policyId],
        )
      ).rows[0];
      if (!version) throw new AppError("That policy has no version to review.", 400, "POLICY_HAS_NO_VERSION");
      fileName = version.file_name;
      buffer = await readEncryptedFile(version.storage_path, version.sha256);
      policyId = version.policy_id;
      policyVersionId = version.id;
    }

    // Read and size-check now, so problems are reported straight away rather than as a failed review.
    const text = await documentText(buffer, fileName);
    const prepared = input.redact ? redactPersonalData(text) : { text, counts: {}, total: 0 };
    if (prepared.text.length > MAX_DOCUMENT_CHARS) {
      throw new AppError(
        `This document is too long to review in one go (${Math.round(prepared.text.length / 1000)}k characters). Split it into parts.`,
        400,
        "DOCUMENT_TOO_LONG",
      );
    }
    const criteria = await buildCriteria(input);
    const stored = input.source === "upload" ? await storeEncryptedFile(UPLOAD_FOLDER, buffer) : null;

    let row: ReviewRow;
    try {
      row = (
        await query<ReviewRow>(
          `INSERT INTO compliance_ai_reviews (source, policy_id, policy_version_id, document_type, file_name, storage_path, sha256,
             criteria, redacted, redactions, status, provider, model, input_chars, requested_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'queued', $11, $12, $13, $14)
           RETURNING *`,
          [
            input.source,
            policyId,
            policyVersionId,
            input.documentType,
            fileName,
            stored?.storagePath ?? null,
            stored?.sha256 ?? null,
            JSON.stringify(criteria),
            input.redact,
            JSON.stringify(prepared.counts),
            AI_PROVIDER,
            env.ai.model,
            prepared.text.length,
            actor.email,
          ],
        )
      ).rows[0];
    } catch (error) {
      if (stored) await removeStoredFiles([stored.storagePath]);
      throw error;
    }

    await log(actor, "ai.review_requested", fileName, {
      provider: AI_PROVIDER,
      model: env.ai.model,
      documentType: input.documentType,
      criteria: criteria.map((c) => c.label),
      charactersSent: prepared.text.length,
      redacted: input.redact,
      redactions: prepared.total,
    });
    void processReview(row.id, actor);
    return toDetail(row);
  },

  async requestDraft(id: string, actor: ReviewActor): Promise<ReviewDetail> {
    const row = await getRow(id);
    if (row.status !== "completed") throw new AppError("Wait for the review to finish first.", 400, "AI_REVIEW_NOT_READY");
    if (row.draft_status === "running") throw new AppError("A draft is already being prepared.", 409, "AI_DRAFT_RUNNING");
    if (!env.ai.configured) {
      throw new AppError("AI review is not set up yet. Add the AI provider's API key to the server settings.", 503, "AI_NOT_CONFIGURED");
    }
    await query("UPDATE compliance_ai_reviews SET draft_status = 'running', draft_error = NULL WHERE id = $1", [id]);
    await log(actor, "ai.draft_requested", row.file_name, { model: env.ai.model });
    void processDraft(id, actor);
    return this.get(id);
  },

  async draftDocx(id: string, actor: ReviewActor): Promise<{ buffer: Buffer; fileName: string }> {
    const row = await getRow(id);
    if (!row.draft_text) throw new AppError("There is no draft yet.", 404, "AI_DRAFT_NOT_FOUND");
    const base = row.file_name.replace(/\.[^.]+$/, "");
    const buffer = await draftToDocx(base, row.draft_text, DRAFT_NOTE);
    await log(actor, "ai.draft_downloaded", row.file_name);
    return { buffer, fileName: `${base} - AI draft.docx` };
  },

  /** Puts the draft into the Policy Library as a new version awaiting the Principal's approval. */
  async submitDraft(id: string, actor: ReviewActor): Promise<ReviewDetail> {
    const row = await getRow(id);
    if (row.source !== "policy" || !row.policy_id) {
      throw new AppError("Only drafts of Policy Library documents can be sent to the library.", 400, "AI_DRAFT_NOT_POLICY");
    }
    if (!row.draft_text) throw new AppError("There is no draft yet.", 404, "AI_DRAFT_NOT_FOUND");
    if (row.draft_submitted_version_id) throw new AppError("This draft has already been sent to the Policy Library.", 409, "AI_DRAFT_ALREADY_SUBMITTED");
    if (!hasAccess(actor.permissions, "policies", "edit")) {
      throw new AppError("You need edit access to the Policy Library to send a draft there.", 403, "FORBIDDEN");
    }

    const base = row.file_name.replace(/\.[^.]+$/, "");
    const buffer = await draftToDocx(base, row.draft_text, DRAFT_NOTE);
    const detail = await policyLibraryService.addVersion(
      row.policy_id,
      {
        originalname: `${base} (AI-assisted draft).docx`,
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: buffer.length,
        buffer,
      },
      `AI-assisted revision prepared from the review of ${new Date(row.created_at).toLocaleDateString("en-GB")}. Check every change and complete any [TO BE COMPLETED] items before approving.`,
      { userId: actor.userId, email: actor.email, role: actor.role, ip: actor.ip ?? null },
    );
    const versionId = detail.pendingVersion?.id ?? null;
    await query("UPDATE compliance_ai_reviews SET draft_submitted_version_id = $2 WHERE id = $1", [id, versionId]);
    await log(actor, "ai.draft_submitted", row.file_name, { policy: detail.title, version: detail.pendingVersion?.versionNumber ?? null });
    return this.get(id);
  },

  /** On start-up, reviews cut off by a restart are marked failed so nobody waits on them for ever. */
  async failInterrupted(): Promise<void> {
    await query(
      `UPDATE compliance_ai_reviews SET status = 'failed', error = 'Interrupted by a server restart. Run the review again.', completed_at = NOW()
       WHERE status IN ('queued', 'running')`,
    );
    await query(
      `UPDATE compliance_ai_reviews SET draft_status = 'failed', draft_error = 'Interrupted by a server restart. Try again.'
       WHERE draft_status = 'running'`,
    );
  },
};
