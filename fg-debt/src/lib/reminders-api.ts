import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type Recurrence = "none" | "monthly" | "quarterly" | "six_monthly" | "annual";
export type ReminderSource = "task" | "policy_review" | "risk_review" | "sqm_review" | "policy_approval" | "risk_approval" | "register_due" | "training_due" | "business_due";
export type Urgency = "overdue" | "due_soon" | "upcoming" | "approval";

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "One-off",
  monthly: "Monthly",
  quarterly: "Quarterly",
  six_monthly: "Every 6 months",
  annual: "Annually",
};

export const SOURCE_LABELS: Record<ReminderSource, string> = {
  task: "Calendar task",
  policy_review: "Policy review",
  risk_review: "Risk review",
  sqm_review: "SQM review",
  policy_approval: "Policy approval",
  risk_approval: "Risk approval",
  register_due: "Register action due",
  training_due: "Training & appraisals",
  business_due: "Business & financial review",
};

export interface Task {
  id: string;
  seriesId: string;
  title: string;
  notes: string;
  area: string;
  owner: string;
  dueDate: string;
  recurrence: Recurrence;
  status: "open" | "completed" | "cancelled";
  completedAt: string | null;
  completedBy: string | null;
  completionNote: string | null;
}

export interface ReminderItem {
  key: string;
  source: ReminderSource;
  title: string;
  area: string;
  owner: string;
  dueDate: string | null;
  urgency: Urgency;
  link: string;
  task: Task | null;
}

/** Search params that make "Open" land on the item itself (a risk opens its own edit window). */
export function reminderSearch(item: Pick<ReminderItem, "key" | "source">): { risk?: string } {
  if (item.source === "risk_review" || item.source === "risk_approval") {
    return { risk: item.key.slice(item.key.indexOf(":") + 1) };
  }
  return {};
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
  alreadyAdded: boolean;
}

export interface DigestStatus {
  mailConfigured: boolean;
  sendHour: number;
  timeZone: string;
  lastDigest: { date: string; status: string; itemCount: number; error: string | null } | null;
}

export interface TaskInput {
  title: string;
  notes: string;
  area: string;
  owner: string;
  dueDate: string;
  recurrence: Recurrence;
}

const BASE = "/api/compliance/reminders";
const KEY = ["compliance", "reminders"] as const;

export function useReminders() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiRequest<{ items: ReminderItem[]; summary: ReminderSummary; areas: string[] }>(BASE),
  });
}

export function useTaskHistory(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "history"],
    queryFn: () => apiRequest<{ tasks: Task[] }>(`${BASE}/history`).then((r) => r.tasks),
    enabled,
  });
}

export function useSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "suggestions"],
    queryFn: () => apiRequest<{ suggestions: Suggestion[] }>(`${BASE}/suggestions`).then((r) => r.suggestions),
    enabled,
  });
}

export function useDigestStatus(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "digest"],
    queryFn: () => apiRequest<DigestStatus>(`${BASE}/digest`),
    enabled,
  });
}

/** Any change refreshes the calendar, its history and the suggestion list. */
function useReminderMutation<T, R>(fn: (payload: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateTask() {
  return useReminderMutation((body: TaskInput) => apiRequest<{ task: Task }>(`${BASE}/tasks`, { method: "POST", body }));
}

export function useUpdateTask() {
  return useReminderMutation(({ id, ...body }: Partial<TaskInput> & { id: string }) =>
    apiRequest<{ task: Task }>(`${BASE}/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useCompleteTask() {
  return useReminderMutation(({ id, note }: { id: string; note?: string }) =>
    apiRequest<{ completed: Task; next: Task | null }>(`${BASE}/tasks/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      body: note ? { note } : {},
    }),
  );
}

export function useCancelTask() {
  return useReminderMutation(({ id, note }: { id: string; note?: string }) =>
    apiRequest<{ task: Task }>(`${BASE}/tasks/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: note ? { note } : {},
    }),
  );
}

export function useAddSuggestions() {
  return useReminderMutation((keys: string[]) =>
    apiRequest<{ added: number; skipped: number }>(`${BASE}/suggestions`, { method: "POST", body: { keys } }),
  );
}

export function useSendDigest() {
  return useReminderMutation(() =>
    apiRequest<{ status: "sent" | "logged" | "nothing_due"; itemCount: number }>(`${BASE}/digest/send`, { method: "POST" }),
  );
}
