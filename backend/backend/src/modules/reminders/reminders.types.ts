export const RECURRENCES = ["none", "monthly", "quarterly", "six_monthly", "annual"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const TASK_AREAS = [
  "Files & deadlines",
  "Finance",
  "Complaints",
  "Incidents",
  "Risk",
  "AML",
  "Data protection",
  "IT & security",
  "Business continuity",
  "Supervision & training",
  "Policies",
  "Governance",
  "SQM",
  "Other",
] as const;

/** Items due within this many days count as "due soon" on the calendar. */
export const DUE_SOON_DAYS = 30;
/** The daily email lists items overdue or due within this many days. */
export const DIGEST_WINDOW_DAYS = 7;

export interface TaskRow {
  id: string;
  series_id: string;
  title: string;
  notes: string;
  area: string;
  owner: string;
  due_date: string;
  recurrence: Recurrence;
  status: "open" | "completed" | "cancelled";
  completed_at: Date | null;
  completed_by: string | null;
  completion_note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Task {
  id: string;
  seriesId: string;
  title: string;
  notes: string;
  area: string;
  owner: string;
  dueDate: string;
  recurrence: Recurrence;
  status: TaskRow["status"];
  completedAt: string | null;
  completedBy: string | null;
  completionNote: string | null;
}

export type ReminderSource =
  | "task"
  | "policy_review"
  | "risk_review"
  | "sqm_review"
  | "register_due"
  | "training_due"
  | "business_due"
  | "policy_approval"
  | "risk_approval";
export type Urgency = "overdue" | "due_soon" | "upcoming" | "approval";

/** One line on the compliance calendar, whatever module it comes from. */
export interface ReminderItem {
  key: string;
  source: ReminderSource;
  title: string;
  area: string;
  owner: string;
  /** null for approvals, which have no deadline but stay listed until decided. */
  dueDate: string | null;
  urgency: Urgency;
  /** Frontend path where the item is dealt with. */
  link: string;
  task: Task | null;
}

export interface ReminderSummary {
  overdue: number;
  dueSoon: number;
  approvals: number;
  completedThisMonth: number;
}

export interface Suggestion {
  key: string;
  title: string;
  area: string;
  recurrence: Recurrence;
  firstDueDate: string;
  /** An open task with the same title already exists, so adding it again is skipped. */
  alreadyAdded: boolean;
}

export interface DigestStatus {
  mailConfigured: boolean;
  sendHour: number;
  timeZone: string;
  lastDigest: { date: string; status: string; itemCount: number; error: string | null } | null;
}
