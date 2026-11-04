import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { todayIso } from "../registers/registers.helpers.js";
import { registersService, type RegisterActor, type RegisterEntry } from "../registers/registers.service.js";
import { buildFileReviewReport } from "./file-reviews.report.js";

export type Answer = "yes" | "no" | "na";

interface QuestionRow {
  id: string;
  section: string;
  question: string;
  guidance: string;
  sort_order: number;
  archived: boolean;
}

interface SavedAnswer {
  questionId: string;
  answer: Answer | null;
  comment: string;
  /** Kept on completion so the review still reads correctly after the question is changed or removed. */
  section?: string;
  question?: string;
  guidance?: string;
}

export interface DraftAction {
  action: string;
  responsible: string;
  dueDate: string | null;
}

interface ReviewRow {
  id: string;
  matter_ref: string;
  matter_type: string;
  fee_earner: string;
  reviewer: string;
  review_date: string;
  status: "draft" | "completed";
  answers: SavedAnswer[];
  findings: string;
  actions: DraftAction[];
  register_entry_id: string | null;
  register_ref: string | null;
  action_entry_ids: string[];
  created_by_id: string | null;
  created_by: string;
  updated_by: string | null;
  completed_by: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Question {
  id: string;
  section: string;
  question: string;
  guidance: string;
  sortOrder: number;
}

export interface ChecklistItem {
  questionId: string;
  section: string;
  question: string;
  guidance: string;
  answer: Answer | null;
  comment: string;
}

export interface ReviewHeader {
  matterRef: string;
  matterType: string;
  feeEarner: string;
  reviewer: string;
  reviewDate: string;
}

const REVIEW_COLUMNS = "*, review_date::text AS review_date";

function log(actor: RegisterActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "file_review", entityId, details, ip: actor.ip ?? null });
}

function label(row: Pick<ReviewRow, "register_ref" | "matter_ref">) {
  return row.register_ref ? `${row.register_ref} (${row.matter_ref})` : `Draft review of ${row.matter_ref}`;
}

function toQuestion(row: QuestionRow): Question {
  return { id: row.id, section: row.section, question: row.question, guidance: row.guidance, sortOrder: row.sort_order };
}

async function activeQuestions(): Promise<Question[]> {
  return (
    await query<QuestionRow>("SELECT * FROM compliance_file_review_questions WHERE NOT archived ORDER BY sort_order, created_at")
  ).rows.map(toQuestion);
}

/** A draft follows the current checklist; a completed review shows the wording it was completed against. */
function checklistFor(row: ReviewRow, questions: Question[]): ChecklistItem[] {
  if (row.status === "completed") {
    return row.answers.map((a) => ({
      questionId: a.questionId,
      section: a.section ?? "",
      question: a.question ?? "",
      guidance: a.guidance ?? "",
      answer: a.answer,
      comment: a.comment,
    }));
  }
  const saved = new Map(row.answers.map((a) => [a.questionId, a]));
  return questions.map((q) => ({
    questionId: q.id,
    section: q.section,
    question: q.question,
    guidance: q.guidance,
    answer: saved.get(q.id)?.answer ?? null,
    comment: saved.get(q.id)?.comment ?? "",
  }));
}

function summary(row: ReviewRow) {
  return {
    id: row.id,
    ref: row.register_ref,
    matterRef: row.matter_ref,
    matterType: row.matter_type,
    feeEarner: row.fee_earner,
    reviewer: row.reviewer,
    reviewDate: row.review_date,
    status: row.status,
    issues: row.answers.filter((a) => a.answer === "no").length,
    actions: row.status === "completed" ? row.action_entry_ids.length : row.actions.length,
    createdBy: row.created_by,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  };
}

async function getRow(id: string): Promise<ReviewRow> {
  const row = (await query<ReviewRow>(`SELECT ${REVIEW_COLUMNS} FROM compliance_file_reviews WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("File review not found.", 404, "FILE_REVIEW_NOT_FOUND");
  return row;
}

/** Drafts are changed by the person who started them or by the Principal. */
function assertCanChangeDraft(row: ReviewRow, actor: RegisterActor) {
  if (row.status !== "draft") throw new AppError("This review has been completed and can no longer be changed.", 409, "FILE_REVIEW_COMPLETED");
  if (actor.role !== "principal" && row.created_by_id !== actor.userId) {
    throw new AppError("Only the person who started this review or the Principal can change it.", 403, "FORBIDDEN");
  }
}

function isDone(entry: RegisterEntry) {
  return entry.open === false;
}

export const fileReviewsService = {
  async overview() {
    const [questions, rows] = await Promise.all([
      activeQuestions(),
      query<ReviewRow>(`SELECT ${REVIEW_COLUMNS} FROM compliance_file_reviews ORDER BY compliance_file_reviews.review_date DESC, created_at DESC`).then((r) => r.rows),
    ]);

    // Recurring issues: how often each checklist question was answered "No" in completed reviews.
    const completed = rows.filter((r) => r.status === "completed");
    const counts = new Map<string, { question: string; section: string; no: number; asked: number }>();
    for (const review of completed) {
      for (const a of review.answers) {
        if (a.answer === null || a.answer === "na") continue;
        const item = counts.get(a.questionId) ?? { question: a.question ?? "", section: a.section ?? "", no: 0, asked: 0 };
        item.asked += 1;
        if (a.answer === "no") item.no += 1;
        counts.set(a.questionId, item);
      }
    }
    const recurring = [...counts.entries()]
      .filter(([, v]) => v.no > 0)
      .map(([questionId, v]) => ({ questionId, ...v }))
      .sort((a, b) => b.no - a.no || b.no / b.asked - a.no / a.asked)
      .slice(0, 10);

    return {
      questions,
      reviews: rows.map(summary),
      recurring,
      stats: {
        completed: completed.length,
        drafts: rows.length - completed.length,
        thisYear: completed.filter((r) => r.review_date.startsWith(todayIso().slice(0, 4))).length,
        withIssues: completed.filter((r) => r.answers.some((a) => a.answer === "no")).length,
      },
    };
  },

  async addQuestions(input: { section: string; questions: string[]; guidance: string }, actor: RegisterActor): Promise<Question[]> {
    const texts = input.questions.map((q) => q.trim()).filter(Boolean);
    if (!texts.length) throw new AppError("Write at least one question.", 400, "VALIDATION_ERROR");
    const start = (await query<{ max: number | null }>("SELECT MAX(sort_order) AS max FROM compliance_file_review_questions")).rows[0]?.max ?? 0;
    const added: Question[] = [];
    for (const [i, text] of texts.entries()) {
      const row = (
        await query<QuestionRow>(
          `INSERT INTO compliance_file_review_questions (section, question, guidance, sort_order, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [input.section, text, texts.length === 1 ? input.guidance : "", start + i + 1, actor.email],
        )
      ).rows[0]!;
      added.push(toQuestion(row));
    }
    await log(actor, "file_review.questions_added", "File review checklist", { section: input.section, count: added.length });
    return added;
  },

  async updateQuestion(id: string, input: { section?: string; question?: string; guidance?: string; sortOrder?: number }, actor: RegisterActor) {
    const row = (
      await query<QuestionRow>(
        `UPDATE compliance_file_review_questions SET section = COALESCE($2, section), question = COALESCE($3, question),
           guidance = COALESCE($4, guidance), sort_order = COALESCE($5, sort_order), updated_by = $6, updated_at = NOW()
         WHERE id = $1 AND NOT archived RETURNING *`,
        [id, input.section ?? null, input.question ?? null, input.guidance ?? null, input.sortOrder ?? null, actor.email],
      )
    ).rows[0];
    if (!row) throw new AppError("Question not found.", 404, "QUESTION_NOT_FOUND");
    await log(actor, "file_review.question_updated", "File review checklist", { changed: Object.keys(input) });
    return toQuestion(row);
  },

  /** Archived, not deleted: completed reviews keep their own copy of the wording. */
  async removeQuestion(id: string, actor: RegisterActor) {
    const result = await query("UPDATE compliance_file_review_questions SET archived = TRUE, updated_by = $2, updated_at = NOW() WHERE id = $1 AND NOT archived", [id, actor.email]);
    if (!result.rowCount) throw new AppError("Question not found.", 404, "QUESTION_NOT_FOUND");
    await log(actor, "file_review.question_removed", "File review checklist");
  },

  async start(input: ReviewHeader, actor: RegisterActor) {
    const row = (
      await query<ReviewRow>(
        `INSERT INTO compliance_file_reviews (matter_ref, matter_type, fee_earner, reviewer, review_date, created_by_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING ${REVIEW_COLUMNS}`,
        [input.matterRef, input.matterType, input.feeEarner, input.reviewer, input.reviewDate, actor.userId, actor.email],
      )
    ).rows[0]!;
    await log(actor, "file_review.started", label(row));
    return summary(row);
  },

  async get(id: string, actor: RegisterActor) {
    const row = await getRow(id);
    const questions = row.status === "draft" ? await activeQuestions() : [];
    const linked = await registersService.byIds(row.action_entry_ids, actor);
    return {
      ...summary(row),
      checklist: checklistFor(row, questions),
      findings: row.findings,
      draftActions: row.status === "draft" ? row.actions : [],
      correctiveActions: row.action_entry_ids
        .map((entryId) => linked.find((e) => e.id === entryId))
        .filter((e): e is RegisterEntry => !!e),
      registerEntryId: row.register_entry_id,
      completedBy: row.completed_by,
      canChange: row.status === "draft" && (actor.role === "principal" || row.created_by_id === actor.userId),
    };
  },

  async saveDraft(
    id: string,
    input: Partial<ReviewHeader> & { answers?: Array<{ questionId: string; answer: Answer | null; comment: string }>; findings?: string; actions?: DraftAction[] },
    actor: RegisterActor,
  ) {
    const row = await getRow(id);
    assertCanChangeDraft(row, actor);
    await query(
      `UPDATE compliance_file_reviews SET matter_ref = $2, matter_type = $3, fee_earner = $4, reviewer = $5, review_date = $6,
         answers = $7, findings = $8, actions = $9, updated_by = $10, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        input.matterRef ?? row.matter_ref,
        input.matterType ?? row.matter_type,
        input.feeEarner ?? row.fee_earner,
        input.reviewer ?? row.reviewer,
        input.reviewDate ?? row.review_date,
        JSON.stringify(input.answers ?? row.answers),
        input.findings ?? row.findings,
        JSON.stringify(input.actions ?? row.actions),
        actor.email,
      ],
    );
    await log(actor, "file_review.saved", label(row));
    return this.get(id, actor);
  },

  /**
   * Completes the review: every question must be answered. The review is added to the "File reviews" register
   * and each action to the "Corrective actions" register, where deadlines and completion are tracked.
   */
  async complete(id: string, actor: RegisterActor) {
    const row = await getRow(id);
    assertCanChangeDraft(row, actor);
    const checklist = checklistFor(row, await activeQuestions());
    if (!checklist.length) throw new AppError("The checklist has no questions yet. The Principal adds them under Checklist questions.", 400, "CHECKLIST_EMPTY");
    const unanswered = checklist.filter((c) => c.answer === null).length;
    if (unanswered) throw new AppError(`Answer every question first (${unanswered} left).`, 400, "CHECKLIST_INCOMPLETE");

    const issues = checklist.filter((c) => c.answer === "no");
    const keyFindings = [row.findings.trim(), ...issues.map((c) => `No: ${c.question}${c.comment ? ` — ${c.comment}` : ""}`)].filter(Boolean).join("\n");
    const today = todayIso();

    const client = await pool.connect();
    let reviewRef: string;
    const actionRefs: string[] = [];
    try {
      await client.query("BEGIN");
      // Locks the review so it cannot be completed twice at the same moment.
      const locked = (await client.query<{ status: string }>("SELECT status FROM compliance_file_reviews WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (locked?.status !== "draft") throw new AppError("This review has already been completed.", 409, "FILE_REVIEW_COMPLETED");

      const entry = await registersService.addWithin(
        client,
        "file_reviews",
        {
          reviewDate: row.review_date,
          fileReference: row.matter_ref,
          matterType: row.matter_type,
          reviewer: row.reviewer,
          keyFindings: keyFindings.slice(0, 5000),
          responsible: row.fee_earner,
          issuesIdentified: issues.length || row.actions.length ? "Yes" : "No",
          actionRequired: row.actions.map((a) => `- ${a.action}`).join("\n").slice(0, 5000),
          status: row.actions.length ? "Open" : "Closed - No Action Required",
        },
        actor,
      );
      reviewRef = entry.ref;

      const actionIds: string[] = [];
      for (const a of row.actions) {
        const added = await registersService.addWithin(
          client,
          "corrective_actions",
          { dateRaised: today, source: "File review", sourceRef: `${entry.ref} / ${row.matter_ref}`, action: a.action, responsible: a.responsible, dueDate: a.dueDate, status: "Open" },
          actor,
        );
        actionIds.push(added.id);
        actionRefs.push(added.ref);
      }

      await client.query(
        `UPDATE compliance_file_reviews SET status = 'completed', answers = $2, register_entry_id = $3, register_ref = $4, action_entry_ids = $5,
           completed_by = $6, completed_at = NOW(), updated_by = $6, updated_at = NOW()
         WHERE id = $1`,
        [
          id,
          JSON.stringify(checklist.map((c) => ({ questionId: c.questionId, answer: c.answer, comment: c.comment, section: c.section, question: c.question, guidance: c.guidance }))),
          entry.id,
          entry.ref,
          actionIds,
          actor.email,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await log(actor, "file_review.completed", `${reviewRef} (${row.matter_ref})`, { issues: issues.length, correctiveActions: actionRefs });
    return this.get(id, actor);
  },

  /** Confirms a corrective action from this review is done; when all are, the register entry is closed. */
  async completeAction(id: string, entryId: string, notes: string, actor: RegisterActor) {
    const row = await getRow(id);
    if (row.status !== "completed" || !row.action_entry_ids.includes(entryId)) {
      throw new AppError("That action does not belong to this review.", 404, "ACTION_NOT_FOUND");
    }
    await registersService.update(entryId, { data: { status: "Done", dateCompleted: todayIso(), ...(notes ? { notes } : {}) } }, actor);

    const actions = await registersService.byIds(row.action_entry_ids, actor);
    if (row.register_entry_id && actions.length === row.action_entry_ids.length && actions.every(isDone)) {
      await registersService.update(row.register_entry_id, { data: { status: "Closed", completionDate: todayIso() } }, actor);
    }
    return this.get(id, actor);
  },

  /** Drafts only; a completed review is part of the record. */
  async removeDraft(id: string, actor: RegisterActor) {
    const row = await getRow(id);
    assertCanChangeDraft(row, actor);
    await query("DELETE FROM compliance_file_reviews WHERE id = $1 AND status = 'draft'", [id]);
    await log(actor, "file_review.draft_deleted", label(row));
  },

  async report(id: string, actor: RegisterActor): Promise<{ buffer: Buffer; fileName: string }> {
    const review = await this.get(id, actor);
    await log(actor, "file_review.report_downloaded", review.ref ? `${review.ref} (${review.matterRef})` : `Draft review of ${review.matterRef}`);
    const name = review.ref ?? "draft";
    return { buffer: await buildFileReviewReport(review), fileName: `File review ${name} ${review.matterRef}.docx` };
  },
};

export type FileReviewDetail = Awaited<ReturnType<typeof fileReviewsService.get>>;
