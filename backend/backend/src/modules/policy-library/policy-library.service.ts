import mammoth from "mammoth";
import type pg from "pg";
import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { documentText } from "../../utils/document-text.js";
import { draftToDocx } from "../../utils/draft-docx.js";
import { readEncryptedFile, removeStoredFiles, storeEncryptedFile } from "../../utils/encrypted-store.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { effectivePermissions, hasAccess } from "../compliance-access/access.helpers.js";
import type { AccessLevel } from "../compliance-access/access.types.js";
import {
  nextPolicyReviewDate,
  reviewState,
  summarizePolicies,
  todayIso,
  toVersion,
} from "./policy-library.helpers.js";
import {
  POLICY_CATEGORIES,
  type Policy,
  type PolicyAcknowledgement,
  type PolicyDetail,
  type PolicyRow,
  type PolicySummary,
  type VersionRow,
} from "./policy-library.types.js";
import type { CreatePolicyInput, UpdatePolicyInput } from "./policy-library.validators.js";

export interface PolicyActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  ip?: string | null;
}

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const STORAGE_FOLDER = "compliance-policies";

// DATE columns come back as text so they are not shifted by the server's time zone.
const POLICY_COLUMNS = `id, title, category, owner, review_frequency, current_version_id,
  last_reviewed_at::text AS last_reviewed_at, next_review_date::text AS next_review_date, archived,
  created_by, updated_by, created_at, updated_at`;
const VERSION_COLUMNS = `id, policy_id, version_number, status, change_summary, file_name, mime_type, size_bytes,
  storage_path, sha256, submitted_by, submitted_at, approved_by, approved_on::text AS approved_on, decided_at,
  rejection_reason, rejected_by`;

function log(actor: PolicyActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({
    userId: actor.userId,
    userEmail: actor.email,
    action,
    entityType: "policy",
    entityId,
    details,
    ip: actor.ip,
  });
}

function requirePrincipal(actor: PolicyActor, what: string) {
  if (actor.role !== "principal") {
    throw new AppError(`Only the Principal can ${what}.`, 403, "FORBIDDEN");
  }
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

/**
 * Word HTML (from mammoth) to the plain editing format draftToDocx reads back:
 * "# " / "## " headings, "- " list items, one paragraph per line.
 */
function wordHtmlToEditableText(html: string): string {
  const text = html
    // A table row becomes one line, its cells separated by " | " (cells hold their own paragraphs).
    .replace(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag: string, cell: string) => `${cell.replace(/<\/p>\s*<p[^>]*>/gi, " ").replace(/<\/?p[^>]*>/gi, "")} | `)
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi, "\n## $1\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(p|tr|ul|ol|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s*\|\s*$/, "").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Files written during a transaction, so they can be removed if it rolls back. */
type WrittenFiles = string[];

async function insertVersion(
  client: pg.PoolClient,
  written: WrittenFiles,
  policyId: string,
  versionNumber: number,
  file: UploadedFile,
  changeSummary: string,
  actor: PolicyActor,
): Promise<VersionRow> {
  const stored = await storeEncryptedFile(STORAGE_FOLDER, file.buffer);
  written.push(stored.storagePath);
  const result = await client.query<VersionRow>(
    `INSERT INTO compliance_policy_versions (
       policy_id, version_number, status, change_summary, file_name, mime_type, size_bytes, storage_path, sha256, submitted_by
     ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${VERSION_COLUMNS}`,
    [policyId, versionNumber, changeSummary, file.originalname, file.mimetype, file.size, stored.storagePath, stored.sha256, actor.email],
  );
  return result.rows[0];
}

/** Puts a pending version in force: previous one is superseded, review dates restart from the approval date. */
async function approveInTx(client: pg.PoolClient, version: VersionRow, approvedOn: string, actor: PolicyActor) {
  const policy = (await client.query<PolicyRow>(`SELECT ${POLICY_COLUMNS} FROM compliance_policies WHERE id = $1 FOR UPDATE`, [version.policy_id])).rows[0];
  if (policy.current_version_id) {
    await client.query("UPDATE compliance_policy_versions SET status = 'superseded' WHERE id = $1", [policy.current_version_id]);
  }
  await client.query(
    `UPDATE compliance_policy_versions SET status = 'approved', approved_by = $2, approved_on = $3, decided_at = NOW()
     WHERE id = $1`,
    [version.id, actor.email, approvedOn],
  );
  await client.query(
    `UPDATE compliance_policies SET current_version_id = $2, last_reviewed_at = $3, next_review_date = $4,
       updated_by = $5, updated_at = NOW()
     WHERE id = $1`,
    [policy.id, version.id, approvedOn, nextPolicyReviewDate(approvedOn, policy.review_frequency), actor.email],
  );
}

async function inTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      throw new AppError("A policy with this title already exists, or a version is already waiting for approval.", 409, "POLICY_CONFLICT");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getPolicyRow(id: string): Promise<PolicyRow> {
  const row = (await query<PolicyRow>(`SELECT ${POLICY_COLUMNS} FROM compliance_policies WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("Policy not found.", 404, "POLICY_NOT_FOUND");
  return row;
}

async function getVersionRow(id: string): Promise<VersionRow> {
  const row = (await query<VersionRow>(`SELECT ${VERSION_COLUMNS} FROM compliance_policy_versions WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("Version not found.", 404, "VERSION_NOT_FOUND");
  return row;
}

/** Builds list items for the given policies, including the caller's acknowledgement status. */
async function buildPolicies(rows: PolicyRow[], actor: PolicyActor): Promise<Policy[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const versions = (
    await query<VersionRow>(
      `SELECT ${VERSION_COLUMNS} FROM compliance_policy_versions
       WHERE policy_id = ANY($1::uuid[]) AND status IN ('pending', 'approved')`,
      [ids],
    )
  ).rows;
  const ackCounts = (
    await query<{ version_id: string; count: number; mine: boolean }>(
      `SELECT version_id, COUNT(*)::int AS count, BOOL_OR(user_id = $2) AS mine
       FROM compliance_policy_acknowledgements
       WHERE version_id = ANY($1::uuid[])
       GROUP BY version_id`,
      [versions.filter((v) => v.status === "approved").map((v) => v.id), actor.userId],
    )
  ).rows;

  return rows.map((row) => {
    const current = versions.find((v) => v.id === row.current_version_id) ?? null;
    const pending = versions.find((v) => v.policy_id === row.id && v.status === "pending") ?? null;
    const acks = current ? ackCounts.find((a) => a.version_id === current.id) : undefined;
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      owner: row.owner,
      reviewFrequency: row.review_frequency,
      archived: row.archived,
      currentVersion: current ? toVersion(current) : null,
      pendingVersion: pending ? toVersion(pending) : null,
      lastReviewedAt: row.last_reviewed_at,
      nextReviewDate: row.next_review_date,
      reviewState: reviewState(Boolean(current), row.next_review_date),
      acknowledgedByMe: current ? Boolean(acks?.mine) : null,
      acknowledgedCount: acks?.count ?? 0,
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

/** Everyone who can see policies, and whether they acknowledged the given version. */
async function acknowledgementsFor(versionId: string): Promise<PolicyAcknowledgement[]> {
  const users = (
    await query<{ id: string; first_name: string; last_name: string; email: string; compliance_role: ComplianceRole }>(
      `SELECT id, first_name, last_name, email, compliance_role FROM users
       WHERE role = 'solicitor' AND compliance_role IS NOT NULL
       ORDER BY first_name, last_name`,
    )
  ).rows;
  const permissions = (
    await query<{ user_id: string; module: string; access_level: AccessLevel }>(
      "SELECT user_id, module, access_level FROM compliance_permissions WHERE user_id = ANY($1::uuid[])",
      [users.map((u) => u.id)],
    )
  ).rows;
  const acks = (
    await query<{ user_id: string; acknowledged_at: Date }>(
      "SELECT user_id, acknowledged_at FROM compliance_policy_acknowledgements WHERE version_id = $1",
      [versionId],
    )
  ).rows;

  return users
    .filter((user) =>
      hasAccess(effectivePermissions(user.compliance_role, permissions.filter((p) => p.user_id === user.id)), "policies", "view"),
    )
    .map((user) => {
      const ack = acks.find((a) => a.user_id === user.id);
      return {
        userId: user.id,
        name: `${user.first_name} ${user.last_name}`.trim(),
        email: user.email,
        acknowledgedAt: ack ? ack.acknowledged_at.toISOString() : null,
      };
    });
}

export const policyLibraryService = {
  async list(actor: PolicyActor): Promise<{ policies: Policy[]; summary: PolicySummary; categories: readonly string[] }> {
    const rows = (await query<PolicyRow>(`SELECT ${POLICY_COLUMNS} FROM compliance_policies ORDER BY LOWER(title)`)).rows;
    const policies = await buildPolicies(rows, actor);
    return { policies, summary: summarizePolicies(policies), categories: POLICY_CATEGORIES };
  },

  async get(id: string, actor: PolicyActor): Promise<PolicyDetail> {
    const row = await getPolicyRow(id);
    const [policy] = await buildPolicies([row], actor);
    const versions = (
      await query<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM compliance_policy_versions WHERE policy_id = $1 ORDER BY version_number DESC`,
        [id],
      )
    ).rows.map(toVersion);
    const acknowledgements =
      actor.role === "principal" && row.current_version_id ? await acknowledgementsFor(row.current_version_id) : null;
    return { ...policy, versions, acknowledgements };
  },

  async create(input: CreatePolicyInput, file: UploadedFile, actor: PolicyActor): Promise<PolicyDetail> {
    if (input.approveNow) requirePrincipal(actor, "approve policies");
    const written: WrittenFiles = [];
    const id = await inTransaction(async (client) => {
      const policy = (
        await client.query<{ id: string }>(
          `INSERT INTO compliance_policies (title, category, owner, review_frequency, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
          [input.title, input.category, input.owner, input.reviewFrequency, actor.email],
        )
      ).rows[0];
      const version = await insertVersion(client, written, policy.id, 1, file, input.changeSummary || "First version", actor);
      if (input.approveNow) {
        await approveInTx(client, version, input.approvedOn ?? todayIso(), actor);
      }
      return policy.id;
    }).catch(async (error) => {
      await removeStoredFiles(written);
      throw error;
    });

    const detail = await this.get(id, actor);
    await log(actor, "policy.created", detail.title, {
      category: detail.category,
      fileName: file.originalname,
      approvedNow: input.approveNow,
      approvedOn: detail.currentVersion?.approvedOn ?? null,
    });
    return detail;
  },

  async update(id: string, input: UpdatePolicyInput, actor: PolicyActor): Promise<PolicyDetail> {
    const before = await getPolicyRow(id);
    const frequency = input.reviewFrequency ?? before.review_frequency;
    // A new frequency counts from the last review; without one there is no review date yet.
    const nextReview =
      frequency !== before.review_frequency && before.last_reviewed_at
        ? nextPolicyReviewDate(before.last_reviewed_at, frequency)
        : before.next_review_date;
    try {
      await query(
        `UPDATE compliance_policies SET title = $2, category = $3, owner = $4, review_frequency = $5,
           next_review_date = $6, updated_by = $7, updated_at = NOW()
         WHERE id = $1`,
        [id, input.title ?? before.title, input.category ?? before.category, input.owner ?? before.owner, frequency, nextReview, actor.email],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new AppError("A policy with this title already exists.", 409, "POLICY_CONFLICT");
      }
      throw error;
    }
    const changed = Object.fromEntries(
      (Object.keys(input) as Array<keyof UpdatePolicyInput>)
        .filter((key) => {
          const column = key === "reviewFrequency" ? "review_frequency" : key;
          return input[key] !== undefined && input[key] !== before[column as keyof PolicyRow];
        })
        .map((key) => [key, input[key]]),
    );
    const detail = await this.get(id, actor);
    await log(actor, "policy.updated", detail.title, { changed });
    return detail;
  },

  /** Submits an amended document. It only takes effect once the Principal approves it. */
  async addVersion(id: string, file: UploadedFile, changeSummary: string, actor: PolicyActor): Promise<PolicyDetail> {
    const policy = await getPolicyRow(id);
    if (policy.archived) throw new AppError("This policy is archived. Restore it before adding a version.", 400, "POLICY_ARCHIVED");
    const written: WrittenFiles = [];
    const version = await inTransaction(async (client) => {
      const next = (
        await client.query<{ next: number }>(
          "SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM compliance_policy_versions WHERE policy_id = $1",
          [id],
        )
      ).rows[0].next;
      return insertVersion(client, written, id, next, file, changeSummary, actor);
    }).catch(async (error) => {
      await removeStoredFiles(written);
      throw error;
    });
    await log(actor, "policy.version_submitted", policy.title, {
      version: version.version_number,
      fileName: file.originalname,
      changeSummary,
    });
    return this.get(id, actor);
  },

  /** Text of the version in force (or the latest one), in the format the in-app editor saves back to Word. */
  async editableText(id: string, actor: PolicyActor): Promise<{ text: string; versionNumber: number; fileName: string }> {
    const policy = await getPolicyRow(id);
    const version = (
      await query<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM compliance_policy_versions WHERE policy_id = $1
         ORDER BY (id = $2) DESC, version_number DESC LIMIT 1`,
        [id, policy.current_version_id],
      )
    ).rows[0];
    if (!version) throw new AppError("This policy has no document yet.", 404, "VERSION_NOT_FOUND");
    const buffer = await readEncryptedFile(version.storage_path, version.sha256);
    let text: string;
    if (version.file_name.toLowerCase().endsWith(".docx")) {
      try {
        text = wordHtmlToEditableText((await mammoth.convertToHtml({ buffer })).value);
      } catch {
        throw new AppError("This Word document could not be read. It may be damaged or password-protected.", 400, "UNREADABLE_DOCUMENT");
      }
    } else {
      text = await documentText(buffer, version.file_name);
    }
    await log(actor, "policy.opened_for_editing", policy.title, { version: version.version_number });
    return { text, versionNumber: version.version_number, fileName: version.file_name };
  },

  /** Saves wording edited in the app as a new Word version. Like an upload, it needs the Principal's approval. */
  async saveEditedText(id: string, text: string, changeSummary: string, actor: PolicyActor): Promise<PolicyDetail> {
    const policy = await getPolicyRow(id);
    const buffer = await draftToDocx(policy.title, text);
    return this.addVersion(
      id,
      { originalname: `${policy.title}.docx`, mimetype: DOCX_MIME, size: buffer.length, buffer },
      changeSummary,
      actor,
    );
  },

  /** Permanently removes a policy with every version, its files and acknowledgements. The access log keeps the record. */
  async remove(id: string, actor: PolicyActor): Promise<void> {
    requirePrincipal(actor, "delete policies");
    const policy = await getPolicyRow(id);
    const files = (
      await query<{ storage_path: string; version_number: number }>(
        "SELECT storage_path, version_number FROM compliance_policy_versions WHERE policy_id = $1",
        [id],
      )
    ).rows;
    await query("DELETE FROM compliance_policies WHERE id = $1", [id]);
    await removeStoredFiles(files.map((f) => f.storage_path));
    await log(actor, "policy.deleted", policy.title, { category: policy.category, versions: files.length });
  },

  async approve(versionId: string, approvedOn: string | undefined, actor: PolicyActor): Promise<PolicyDetail> {
    requirePrincipal(actor, "approve policies");
    const version = await getVersionRow(versionId);
    if (version.status !== "pending") {
      throw new AppError("Only a version waiting for approval can be approved.", 400, "VERSION_NOT_PENDING");
    }
    const on = approvedOn ?? todayIso();
    await inTransaction((client) => approveInTx(client, version, on, actor));
    const detail = await this.get(version.policy_id, actor);
    await log(actor, "policy.approved", detail.title, { version: version.version_number, approvedOn: on });
    return detail;
  },

  async reject(versionId: string, reason: string, actor: PolicyActor): Promise<PolicyDetail> {
    requirePrincipal(actor, "reject policy versions");
    const version = await getVersionRow(versionId);
    if (version.status !== "pending") {
      throw new AppError("Only a version waiting for approval can be rejected.", 400, "VERSION_NOT_PENDING");
    }
    await query(
      `UPDATE compliance_policy_versions SET status = 'rejected', rejection_reason = $2, rejected_by = $3, decided_at = NOW()
       WHERE id = $1`,
      [versionId, reason, actor.email],
    );
    const detail = await this.get(version.policy_id, actor);
    await log(actor, "policy.rejected", detail.title, { version: version.version_number, reason });
    return detail;
  },

  /** The Principal confirms the policy was reviewed and still stands; the next review date moves on. */
  async markReviewed(id: string, actor: PolicyActor): Promise<PolicyDetail> {
    requirePrincipal(actor, "sign off policy reviews");
    const policy = await getPolicyRow(id);
    if (!policy.current_version_id) {
      throw new AppError("Approve a version of this policy before recording a review.", 400, "POLICY_NOT_IN_FORCE");
    }
    const today = todayIso();
    const next = nextPolicyReviewDate(today, policy.review_frequency);
    await query(
      `UPDATE compliance_policies SET last_reviewed_at = $2, next_review_date = $3, updated_by = $4, updated_at = NOW()
       WHERE id = $1`,
      [id, today, next, actor.email],
    );
    await log(actor, "policy.reviewed", policy.title, { nextReviewDate: next });
    return this.get(id, actor);
  },

  async acknowledge(id: string, actor: PolicyActor): Promise<PolicyDetail> {
    const policy = await getPolicyRow(id);
    if (!policy.current_version_id) {
      throw new AppError("There is no approved version of this policy to acknowledge yet.", 400, "POLICY_NOT_IN_FORCE");
    }
    const inserted = await query(
      `INSERT INTO compliance_policy_acknowledgements (version_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [policy.current_version_id, actor.userId],
    );
    if (inserted.rowCount) {
      const version = await getVersionRow(policy.current_version_id);
      await log(actor, "policy.acknowledged", policy.title, { version: version.version_number });
    }
    return this.get(id, actor);
  },

  async setArchived(id: string, archived: boolean, actor: PolicyActor): Promise<PolicyDetail> {
    requirePrincipal(actor, "archive policies");
    const policy = await getPolicyRow(id);
    await query("UPDATE compliance_policies SET archived = $2, updated_by = $3, updated_at = NOW() WHERE id = $1", [
      id,
      archived,
      actor.email,
    ]);
    await log(actor, archived ? "policy.archived" : "policy.restored", policy.title);
    return this.get(id, actor);
  },

  /** Decrypts a stored version and checks it was not altered on disk. */
  async download(versionId: string, actor: PolicyActor): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const version = await getVersionRow(versionId);
    const policy = await getPolicyRow(version.policy_id);
    const buffer = await readEncryptedFile(version.storage_path, version.sha256);
    await log(actor, "policy.downloaded", policy.title, { version: version.version_number, fileName: version.file_name });
    return { buffer, fileName: version.file_name, mimeType: version.mime_type };
  },
};
