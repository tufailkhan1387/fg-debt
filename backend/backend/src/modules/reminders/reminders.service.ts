import { env } from "../../config/env.js";
import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { isMailConfigured, sendMail } from "../../utils/mailer.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { effectivePermissions, hasAccess } from "../compliance-access/access.helpers.js";
import type { PermissionMap } from "../compliance-access/access.types.js";
import { registersService } from "../registers/registers.service.js";
import { trainingService } from "../training/training.service.js";
import { businessService } from "../business/business.service.js";
import {
  addDays,
  buildDigest,
  firstDueDate,
  nextOccurrence,
  sortItems,
  SUGGESTED_ACTIVITIES,
  suggestionKey,
  todayIso,
  toTask,
  urgencyOf,
} from "./reminders.helpers.js";
import {
  DIGEST_WINDOW_DAYS,
  TASK_AREAS,
  type DigestStatus,
  type ReminderItem,
  type ReminderSummary,
  type Suggestion,
  type Task,
  type TaskRow,
} from "./reminders.types.js";
import type { CreateTaskInput, UpdateTaskInput } from "./reminders.validators.js";

export interface ReminderActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  permissions: PermissionMap;
  ip?: string | null;
}

const TASK_COLUMNS = `id, series_id, title, notes, area, owner, due_date::text AS due_date, recurrence, status,
  completed_at, completed_by, completion_note, created_by, updated_by, created_at, updated_at`;

const CALENDAR_PATH = "/solicitor/fg-compliance/calendar";

function log(actor: { userId: string | null; email: string; ip?: string | null }, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({
    userId: actor.userId,
    userEmail: actor.email,
    action,
    entityType: "reminder",
    entityId,
    details,
    ip: actor.ip ?? null,
  });
}

async function getTaskRow(id: string): Promise<TaskRow> {
  const row = (await query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM compliance_tasks WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
  return row;
}

/**
 * Everything open on the compliance calendar that this person may see: calendar tasks, policy and
 * risk review dates (when they can see those areas) and, for the Principal, items awaiting approval.
 */
async function buildFeed(viewer: { userId: string; role: ComplianceRole; permissions: PermissionMap }): Promise<ReminderItem[]> {
  const items: ReminderItem[] = [];

  if (hasAccess(viewer.permissions, "reminders", "view")) {
    const tasks = (await query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM compliance_tasks WHERE status = 'open'`)).rows;
    for (const row of tasks) {
      items.push({
        key: `task:${row.id}`,
        source: "task",
        title: row.title,
        area: row.area,
        owner: row.owner,
        dueDate: row.due_date,
        urgency: urgencyOf(row.due_date),
        link: CALENDAR_PATH,
        task: toTask(row),
      });
    }
  }

  if (hasAccess(viewer.permissions, "policies", "view")) {
    const policies = (
      await query<{ id: string; title: string; owner: string; next_review_date: string }>(
        `SELECT id, title, owner, next_review_date::text AS next_review_date FROM compliance_policies
         WHERE NOT archived AND current_version_id IS NOT NULL AND next_review_date IS NOT NULL`,
      )
    ).rows;
    for (const p of policies) {
      items.push({
        key: `policy:${p.id}`,
        source: "policy_review",
        title: `Review policy: ${p.title}`,
        area: "Policies",
        owner: p.owner,
        dueDate: p.next_review_date,
        urgency: urgencyOf(p.next_review_date),
        link: `/solicitor/fg-compliance/policies/${p.id}`,
        task: null,
      });
    }
  }

  if (hasAccess(viewer.permissions, "risks", "view")) {
    const risks = (
      await query<{ id: string; ref: string; name: string; owner: string; next_review_date: string }>(
        `SELECT id, ref, name, owner, next_review_date::text AS next_review_date FROM compliance_risks
         WHERE status <> 'closed' AND next_review_date IS NOT NULL`,
      )
    ).rows;
    for (const r of risks) {
      items.push({
        key: `risk:${r.id}`,
        source: "risk_review",
        title: `Review risk ${r.ref}: ${r.name}`,
        area: "Risk",
        owner: r.owner,
        dueDate: r.next_review_date,
        urgency: urgencyOf(r.next_review_date),
        link: "/solicitor/fg-compliance/risks",
        task: null,
      });
    }
  }

  if (hasAccess(viewer.permissions, "sqm", "view")) {
    const requirements = (
      await query<{ id: string; ref: string; responsible: string; review_date: string }>(
        `SELECT id, ref, responsible, review_date::text AS review_date FROM compliance_sqm_requirements
         WHERE status <> 'not_applicable' AND review_date IS NOT NULL`,
      )
    ).rows;
    for (const r of requirements) {
      items.push({
        key: `sqm:${r.id}`,
        source: "sqm_review",
        title: `Review SQM requirement ${r.ref}`,
        area: "SQM",
        owner: r.responsible,
        dueDate: r.review_date,
        urgency: urgencyOf(r.review_date),
        link: `/solicitor/fg-compliance/sqm/${r.id}`,
        task: null,
      });
    }
  }

  if (hasAccess(viewer.permissions, "registers", "view")) {
    for (const due of await registersService.dueItems(viewer)) {
      items.push({
        key: `register:${due.id}`,
        source: "register_due",
        title: `${due.label} ${due.ref}${due.summary ? `: ${due.summary}` : ""}`,
        area: "Registers",
        owner: due.owner,
        dueDate: due.dueDate,
        urgency: urgencyOf(due.dueDate),
        link: `/solicitor/fg-compliance/registers/${due.registerKey}`,
        task: null,
      });
    }
  }

  if (hasAccess(viewer.permissions, "training", "view")) {
    for (const due of await trainingService.dueItems({ userId: viewer.userId, email: "", role: viewer.role })) {
      items.push({
        key: `training:${due.key}`,
        source: "training_due",
        title: due.title,
        area: "Training",
        owner: due.owner,
        dueDate: due.dueDate,
        urgency: urgencyOf(due.dueDate),
        link: `/solicitor/fg-compliance/training/${due.staffId}`,
        task: null,
      });
    }
  }

  if (hasAccess(viewer.permissions, "business", "view")) {
    for (const due of await businessService.dueItems()) {
      items.push({
        key: `business:${due.key}`,
        source: "business_due",
        title: due.title,
        area: "Business",
        owner: due.owner,
        dueDate: due.dueDate,
        urgency: urgencyOf(due.dueDate),
        link: "/solicitor/fg-compliance/business",
        task: null,
      });
    }
  }

  if (viewer.role === "principal") {
    const pendingPolicies = (
      await query<{ id: string; title: string; version_number: number }>(
        `SELECT p.id, p.title, v.version_number FROM compliance_policy_versions v
         JOIN compliance_policies p ON p.id = v.policy_id
         WHERE v.status = 'pending' AND NOT p.archived`,
      )
    ).rows;
    for (const p of pendingPolicies) {
      items.push({
        key: `policy-approval:${p.id}`,
        source: "policy_approval",
        title: `Approve policy: ${p.title} (version ${p.version_number})`,
        area: "Policies",
        owner: "",
        dueDate: null,
        urgency: "approval",
        link: `/solicitor/fg-compliance/policies/${p.id}`,
        task: null,
      });
    }
    const pendingRisks = (
      await query<{ id: string; ref: string; name: string }>(
        "SELECT id, ref, name FROM compliance_risks WHERE approval_status = 'pending'",
      )
    ).rows;
    for (const r of pendingRisks) {
      items.push({
        key: `risk-approval:${r.id}`,
        source: "risk_approval",
        title: `Approve risk rating ${r.ref}: ${r.name}`,
        area: "Risk",
        owner: "",
        dueDate: null,
        urgency: "approval",
        link: "/solicitor/fg-compliance/risks",
        task: null,
      });
    }
  }

  return sortItems(items);
}

/** Local calendar date and hour in the reminder time zone (the firm is in the UK; servers may run in UTC). */
function localNow(now = new Date()): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: env.reminderTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Items worth emailing about: overdue, due within the digest window, or awaiting approval. */
function digestItems(items: ReminderItem[], today: string): ReminderItem[] {
  const until = addDays(today, DIGEST_WINDOW_DAYS);
  return items.filter((item) => item.dueDate === null || item.dueDate <= until);
}

const ALL_EDIT = effectivePermissions("principal", []);

export const remindersService = {
  async feed(actor: ReminderActor): Promise<{ items: ReminderItem[]; summary: ReminderSummary; areas: readonly string[] }> {
    const items = await buildFeed(actor);
    const completed = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM compliance_tasks
       WHERE status = 'completed' AND completed_at >= date_trunc('month', NOW())`,
    );
    return {
      items,
      summary: {
        overdue: items.filter((i) => i.urgency === "overdue").length,
        dueSoon: items.filter((i) => i.urgency === "due_soon").length,
        approvals: items.filter((i) => i.urgency === "approval").length,
        completedThisMonth: completed.rows[0]?.count ?? 0,
      },
      areas: TASK_AREAS,
    };
  },

  async history(): Promise<Task[]> {
    const rows = (
      await query<TaskRow>(
        `SELECT ${TASK_COLUMNS} FROM compliance_tasks WHERE status <> 'open'
         ORDER BY COALESCE(completed_at, updated_at) DESC LIMIT 100`,
      )
    ).rows;
    return rows.map(toTask);
  },

  async create(input: CreateTaskInput, actor: ReminderActor): Promise<Task> {
    const row = (
      await query<TaskRow>(
        `INSERT INTO compliance_tasks (title, notes, area, owner, due_date, recurrence, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING ${TASK_COLUMNS}`,
        [input.title, input.notes, input.area, input.owner, input.dueDate, input.recurrence, actor.email],
      )
    ).rows[0];
    const task = toTask(row);
    await log(actor, "reminder.task_created", task.title, { dueDate: task.dueDate, recurrence: task.recurrence });
    return task;
  },

  async update(id: string, input: UpdateTaskInput, actor: ReminderActor): Promise<Task> {
    const before = toTask(await getTaskRow(id));
    if (before.status !== "open") {
      throw new AppError("Only open tasks can be edited.", 400, "TASK_NOT_OPEN");
    }
    const merged = { ...before, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } as Task;
    const row = (
      await query<TaskRow>(
        `UPDATE compliance_tasks SET title = $2, notes = $3, area = $4, owner = $5, due_date = $6, recurrence = $7,
           updated_by = $8, updated_at = NOW()
         WHERE id = $1 RETURNING ${TASK_COLUMNS}`,
        [id, merged.title, merged.notes, merged.area, merged.owner, merged.dueDate, merged.recurrence, actor.email],
      )
    ).rows[0];
    const task = toTask(row);
    const changed = Object.fromEntries(
      (Object.keys(input) as Array<keyof UpdateTaskInput>)
        .filter((key) => input[key] !== undefined && before[key] !== task[key])
        .map((key) => [key, { from: before[key], to: task[key] }]),
    );
    await log(actor, "reminder.task_updated", task.title, { changed });
    return task;
  },

  /** Marks the task done; for a recurring activity the next occurrence is scheduled from this due date. */
  async complete(id: string, note: string | undefined, actor: ReminderActor): Promise<{ completed: Task; next: Task | null }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = (await client.query<TaskRow>(`SELECT ${TASK_COLUMNS} FROM compliance_tasks WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!row) throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
      if (row.status !== "open") throw new AppError("This task is already closed.", 400, "TASK_NOT_OPEN");

      const done = (
        await client.query<TaskRow>(
          `UPDATE compliance_tasks SET status = 'completed', completed_at = NOW(), completed_by = $2, completion_note = $3,
             updated_by = $2, updated_at = NOW()
           WHERE id = $1 RETURNING ${TASK_COLUMNS}`,
          [id, actor.email, note || null],
        )
      ).rows[0];

      let next: TaskRow | null = null;
      if (row.recurrence !== "none") {
        next = (
          await client.query<TaskRow>(
            `INSERT INTO compliance_tasks (series_id, title, notes, area, owner, due_date, recurrence, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING ${TASK_COLUMNS}`,
            [row.series_id, row.title, row.notes, row.area, row.owner, nextOccurrence(row.due_date, row.recurrence), row.recurrence, actor.email],
          )
        ).rows[0];
      }
      await client.query("COMMIT");

      await log(actor, "reminder.task_completed", row.title, {
        dueDate: row.due_date,
        lateByDays: Math.max(0, Math.round((Date.parse(todayIso()) - Date.parse(row.due_date)) / 86_400_000)),
        note: note || null,
        nextDueDate: next?.due_date ?? null,
      });
      return { completed: toTask(done), next: next ? toTask(next) : null };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  /** Closes a task that is no longer needed (kept on record, never deleted). Stops a recurring series. */
  async cancel(id: string, reason: string | undefined, actor: ReminderActor): Promise<Task> {
    const before = await getTaskRow(id);
    if (before.status !== "open") throw new AppError("This task is already closed.", 400, "TASK_NOT_OPEN");
    const row = (
      await query<TaskRow>(
        `UPDATE compliance_tasks SET status = 'cancelled', completed_at = NOW(), completed_by = $2, completion_note = $3,
           updated_by = $2, updated_at = NOW()
         WHERE id = $1 RETURNING ${TASK_COLUMNS}`,
        [id, actor.email, reason || null],
      )
    ).rows[0];
    await log(actor, "reminder.task_cancelled", before.title, { reason: reason || null });
    return toTask(row);
  },

  async suggestions(): Promise<Suggestion[]> {
    const open = new Set(
      (await query<{ title: string }>("SELECT LOWER(title) AS title FROM compliance_tasks WHERE status = 'open'")).rows.map((r) => r.title),
    );
    return SUGGESTED_ACTIVITIES.map((template) => ({
      key: suggestionKey(template.title),
      title: template.title,
      area: template.area,
      recurrence: template.recurrence,
      firstDueDate: firstDueDate(template),
      alreadyAdded: open.has(template.title.toLowerCase()),
    }));
  },

  async addSuggestions(keys: string[], actor: ReminderActor): Promise<{ added: number; skipped: number }> {
    const wanted = new Set(keys);
    const chosen = (await this.suggestions()).filter((s) => wanted.has(s.key));
    const toAdd = chosen.filter((s) => !s.alreadyAdded);
    for (const s of toAdd) {
      await query(
        `INSERT INTO compliance_tasks (title, area, due_date, recurrence, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [s.title, s.area, s.firstDueDate, s.recurrence, actor.email],
      );
    }
    await log(actor, "reminder.suggestions_added", "Compliance calendar", { added: toAdd.map((s) => s.title) });
    return { added: toAdd.length, skipped: keys.length - toAdd.length };
  },

  async digestStatus(actor: ReminderActor): Promise<DigestStatus> {
    const last = (
      await query<{ digest_date: string; status: string; item_count: number; error: string | null }>(
        `SELECT digest_date::text AS digest_date, status, item_count, error FROM compliance_reminder_digests
         WHERE LOWER(recipient) = LOWER($1) ORDER BY digest_date DESC LIMIT 1`,
        [actor.email],
      )
    ).rows[0];
    return {
      mailConfigured: isMailConfigured(),
      sendHour: env.reminderHour,
      timeZone: env.reminderTimeZone,
      lastDigest: last ? { date: last.digest_date, status: last.status, itemCount: last.item_count, error: last.error } : null,
    };
  },

  /** Sends today's digest to the signed-in Principal straight away (e.g. to check the email arrives). */
  async sendDigestNow(actor: ReminderActor): Promise<{ status: "sent" | "logged" | "nothing_due"; itemCount: number }> {
    const today = localNow().date;
    const items = digestItems(await buildFeed({ userId: "", role: "principal", permissions: ALL_EDIT }), today);
    if (items.length === 0) return { status: "nothing_due", itemCount: 0 };
    const message = buildDigest(items, `${env.frontendOrigin}${CALENDAR_PATH}`, today);
    const status = await sendMail({ to: actor.email, ...message });
    await log(actor, "reminder.digest_sent", actor.email, { manual: true, itemCount: items.length, status });
    return { status, itemCount: items.length };
  },

  /**
   * Sends each Principal one email a day (at or after the configured hour) listing overdue items, items due
   * within a week and approvals waiting. A row per recipient per day is claimed first, so it never sends twice.
   */
  async runDailyDigests(now = new Date()): Promise<void> {
    const local = localNow(now);
    if (local.hour < env.reminderHour) return;

    const principals = (
      await query<{ id: string; email: string }>(
        "SELECT id, email FROM users WHERE role = 'solicitor' AND compliance_role = 'principal'",
      )
    ).rows;
    if (principals.length === 0) return;

    const items = digestItems(await buildFeed({ userId: "", role: "principal", permissions: ALL_EDIT }), local.date);
    const message = items.length ? buildDigest(items, `${env.frontendOrigin}${CALENDAR_PATH}`, local.date) : null;

    for (const principal of principals) {
      const claimed = await query(
        `INSERT INTO compliance_reminder_digests (digest_date, recipient, item_count, status)
         VALUES ($1, $2, $3, 'skipped') ON CONFLICT (digest_date, recipient) DO NOTHING RETURNING id`,
        [local.date, principal.email, items.length],
      );
      if (!claimed.rowCount || !message) continue;

      let status: "sent" | "logged" | "failed";
      let error: string | null = null;
      try {
        status = await sendMail({ to: principal.email, ...message });
      } catch (err) {
        status = "failed";
        error = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
      }
      await query("UPDATE compliance_reminder_digests SET status = $2, error = $3 WHERE id = $1", [
        claimed.rows[0].id,
        status,
        error,
      ]);
      await log({ userId: null, email: "system" }, "reminder.digest_sent", principal.email, {
        itemCount: items.length,
        status,
        error,
      });
    }
  },
};

const CHECK_EVERY_MS = 15 * 60 * 1000;

/** Checks every 15 minutes whether today's reminder emails are due. */
export function startReminderScheduler(): void {
  const run = () =>
    remindersService.runDailyDigests().catch((error) => {
      console.error("Compliance reminder digest failed:", error);
    });
  setTimeout(run, 10_000);
  setInterval(run, CHECK_EVERY_MS).unref();
}
