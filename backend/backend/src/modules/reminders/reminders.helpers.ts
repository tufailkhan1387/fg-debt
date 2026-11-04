import { DUE_SOON_DAYS, type Recurrence, type ReminderItem, type Task, type TaskRow, type Urgency } from "./reminders.types.js";

const RECURRENCE_MONTHS: Record<Exclude<Recurrence, "none">, number> = {
  monthly: 1,
  quarterly: 3,
  six_monthly: 6,
  annual: 12,
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Next due date of a recurring activity, keeping it on its schedule. Month-end dates stay at month end
 * (31 Jan → 28/29 Feb → 31 Mar), so monthly reviews do not drift.
 */
export function nextOccurrence(dueIso: string, recurrence: Exclude<Recurrence, "none">): string {
  const due = new Date(`${dueIso}T00:00:00Z`);
  const months = RECURRENCE_MONTHS[recurrence];
  const isMonthEnd = dueIso === lastDayOfMonth(due.getUTCFullYear(), due.getUTCMonth());
  const target = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + months, 1));
  const end = lastDayOfMonth(target.getUTCFullYear(), target.getUTCMonth());
  if (isMonthEnd) return end;
  const day = Math.min(due.getUTCDate(), Number(end.slice(8, 10)));
  return `${end.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

export function urgencyOf(dueDate: string, today = todayIso()): Urgency {
  if (dueDate < today) return "overdue";
  return dueDate <= addDays(today, DUE_SOON_DAYS) ? "due_soon" : "upcoming";
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    seriesId: row.series_id,
    title: row.title,
    notes: row.notes,
    area: row.area,
    owner: row.owner,
    dueDate: row.due_date,
    recurrence: row.recurrence,
    status: row.status,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    completedBy: row.completed_by,
    completionNote: row.completion_note,
  };
}

/** Approvals first, then by due date. */
export function sortItems(items: ReminderItem[]): ReminderItem[] {
  return [...items].sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title);
    if (a.dueDate === null) return -1;
    if (b.dueDate === null) return 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

// ---- Suggested activities ------------------------------------------------------------------
// Taken from the firm's own "Compliance Activities Calendar" sheet in the Master Register workbook.
// Annual activities fall in the month that sheet's annual calendar gives (training in January,
// the BCP test in June, the annual reviews in December).

interface SuggestionTemplate {
  title: string;
  area: string;
  recurrence: Exclude<Recurrence, "none">;
  /** 1–12, for annual activities. */
  month?: number;
}

export const SUGGESTED_ACTIVITIES: SuggestionTemplate[] = [
  { title: "Review active files and key deadlines", area: "Files & deadlines", recurrence: "monthly" },
  { title: "Review diary, limitation dates and court deadlines", area: "Files & deadlines", recurrence: "monthly" },
  { title: "Review invoices, payments and cashflow", area: "Finance", recurrence: "monthly" },
  { title: "Review office account for unexpected receipts", area: "Finance", recurrence: "monthly" },
  { title: "Check complaints received and progress of any complaints", area: "Complaints", recurrence: "monthly" },
  { title: "Check compliance incidents and near misses", area: "Incidents", recurrence: "monthly" },
  { title: "Verify software updates and antivirus status", area: "IT & security", recurrence: "monthly" },
  { title: "Review outstanding client matters and workload", area: "Files & deadlines", recurrence: "monthly" },
  { title: "Review high-risk items on the Risk Register", area: "Risk", recurrence: "monthly" },
  { title: "Verify backups", area: "IT & security", recurrence: "monthly" },

  { title: "Review entire Risk Register, annual income & expenditure and variance analysis", area: "Risk", recurrence: "quarterly" },
  { title: "Review Compliance Incident Register", area: "Incidents", recurrence: "quarterly" },
  { title: "Review Complaints Register and trends", area: "Complaints", recurrence: "quarterly" },
  { title: "Review AML controls and high-risk matters", area: "AML", recurrence: "quarterly" },
  { title: "Review cybersecurity risks", area: "IT & security", recurrence: "quarterly" },
  { title: "Review Business Continuity arrangements", area: "Business continuity", recurrence: "quarterly" },
  { title: "Conduct staff supervision discussions", area: "Supervision & training", recurrence: "quarterly" },
  { title: "Review training needs", area: "Supervision & training", recurrence: "quarterly" },

  { title: "Complete AML refresher training", area: "AML", recurrence: "annual", month: 1 },
  { title: "Complete Data Protection training", area: "Data protection", recurrence: "annual", month: 1 },
  { title: "Complete Cybersecurity Awareness training", area: "IT & security", recurrence: "annual", month: 1 },
  { title: "Review and test Business Continuity Plan", area: "Business continuity", recurrence: "annual", month: 6 },
  { title: "Review all policies and procedures", area: "Policies", recurrence: "annual", month: 12 },
  { title: "Complete annual risk assessment and AML firm-wide risk assessment", area: "Risk", recurrence: "annual", month: 12 },
  { title: "Review Data Processing Activities and Retention Schedule", area: "Data protection", recurrence: "annual", month: 12 },
  { title: "Review Archive Register", area: "Files & deadlines", recurrence: "annual", month: 12 },
  { title: "Review Information Security arrangements", area: "IT & security", recurrence: "annual", month: 12 },
  { title: "Review Risk Register and risk ratings", area: "Risk", recurrence: "annual", month: 12 },
  { title: "Annual review of Complaints Register and trends", area: "Complaints", recurrence: "annual", month: 12 },
  { title: "Annual review of Compliance Incident Register", area: "Incidents", recurrence: "annual", month: 12 },
  { title: "Review Training Register and competence", area: "Supervision & training", recurrence: "annual", month: 12 },
  { title: "Review Strategic Plan, CSR and business objectives", area: "Governance", recurrence: "annual", month: 12 },
  { title: "Review Equality and Diversity arrangements", area: "Governance", recurrence: "annual", month: 12 },
  { title: "Review insurance arrangements", area: "Governance", recurrence: "annual", month: 12 },
  { title: "Review engagement letters and client care documentation", area: "Policies", recurrence: "annual", month: 12 },
  { title: "Review website and regulatory information", area: "Governance", recurrence: "annual", month: 12 },
];

/** First due date: end of this month / this quarter, or the end of the given month (next year if already past). */
export function firstDueDate(template: SuggestionTemplate, today = todayIso()): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  if (template.recurrence === "monthly") return lastDayOfMonth(year, month);
  if (template.recurrence === "quarterly" || template.recurrence === "six_monthly") {
    const step = template.recurrence === "quarterly" ? 3 : 6;
    return lastDayOfMonth(year, Math.floor(month / step) * step + step - 1);
  }
  const target = (template.month ?? 12) - 1;
  const thisYear = lastDayOfMonth(year, target);
  return thisYear >= today ? thisYear : lastDayOfMonth(year + 1, target);
}

export function suggestionKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---- Daily email ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatUk(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Builds the reminder email. Lists titles and dates only, no document contents. */
export function buildDigest(items: ReminderItem[], calendarUrl: string, today: string) {
  const overdue = items.filter((i) => i.urgency === "overdue");
  const approvals = items.filter((i) => i.urgency === "approval");
  const soon = items.filter((i) => i.urgency !== "overdue" && i.urgency !== "approval");

  const sections: Array<[string, ReminderItem[]]> = [
    ["Overdue", overdue],
    ["Due in the next 7 days", soon],
    ["Waiting for your approval", approvals],
  ];
  const line = (item: ReminderItem) =>
    item.dueDate ? `${item.title} — due ${formatUk(item.dueDate)}${item.owner ? ` (${item.owner})` : ""}` : item.title;

  const subjectParts = [
    overdue.length ? `${overdue.length} overdue` : "",
    soon.length ? `${soon.length} due this week` : "",
    approvals.length ? `${approvals.length} to approve` : "",
  ].filter(Boolean);
  const subject = `FG Compliance reminders: ${subjectParts.join(", ")}`;

  const text = [
    `Compliance reminders for ${formatUk(today)}`,
    "",
    ...sections.flatMap(([heading, list]) =>
      list.length ? [`${heading} (${list.length})`, ...list.map((item) => `- ${line(item)}`), ""] : [],
    ),
    `Open the compliance calendar: ${calendarUrl}`,
    "Overdue items stay on this list until they are completed.",
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">
<p>Compliance reminders for <strong>${formatUk(today)}</strong></p>
${sections
  .filter(([, list]) => list.length)
  .map(
    ([heading, list]) =>
      `<h3 style="margin:16px 0 6px;font-size:15px;${heading === "Overdue" ? "color:#be123c" : ""}">${heading} (${list.length})</h3><ul style="margin:0;padding-left:18px">${list
        .map((item) => `<li>${escapeHtml(line(item))}</li>`)
        .join("")}</ul>`,
  )
  .join("\n")}
<p style="margin-top:20px"><a href="${escapeHtml(calendarUrl)}">Open the compliance calendar</a></p>
<p style="color:#6b7280;font-size:12px">Overdue items stay on this list until they are completed.</p>
</div>`;

  return { subject, text, html };
}
