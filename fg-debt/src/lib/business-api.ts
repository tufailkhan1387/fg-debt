import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export interface BusinessRecord {
  id: string;
  activityKey: string;
  period: string;
  completedDate: string;
  summary: string;
  file: { name: string; mime: string; size: number } | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  createdBy: string;
}

export interface Activity {
  key: string;
  title: string;
  everyMonths: number | null;
  nextDue: string | null;
  overdue: boolean;
  owner: string;
  notes: string;
  lastCompleted: string | null;
  records: BusinessRecord[];
}

export interface BudgetSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  lines: number;
  annualIncome: number;
  annualExpense: number;
  quartersSignedOff: number;
  flagged: number;
}

export interface VarianceCell {
  budget: number;
  actual: number | null;
  variance: number | null;
  pct: number | null;
  favourable: boolean | null;
  flagged: boolean;
}

export type Kind = "income" | "expense";
export type Quarterly<T> = [T, T, T, T];

export interface BudgetLine {
  id: string;
  category: string;
  kind: Kind;
  budget: Quarterly<number>;
  actual: Quarterly<number | null>;
  annualBudget: number;
  quarters: Quarterly<VarianceCell>;
}

export interface QuarterTotals {
  quarter: number;
  from: string;
  to: string;
  actualsComplete: boolean;
  incomeBudget: number;
  expenseBudget: number;
  netBudget: number;
  incomeActual: number | null;
  expenseActual: number | null;
  netActual: number | null;
}

export interface QuarterState {
  quarter: number;
  commentary: string;
  lineNotes: Record<string, string>;
  signedOffBy: string | null;
  signedOffAt: string | null;
  flagged: number;
}

export interface Budget {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  thresholdPct: number | null;
  notes: string;
  lines: BudgetLine[];
  totals: Quarterly<QuarterTotals>;
  quarters: Quarterly<QuarterState>;
}

export interface LineInput {
  id?: string;
  category: string;
  kind: Kind;
  budget: Quarterly<number>;
  actual: Quarterly<number | null>;
}

export interface BudgetImportRow {
  rowNumber: number;
  category: string;
  kind: Kind;
  budget: Array<number | null>;
  actual: Array<number | null>;
  action: "new" | "update" | "invalid";
  issues: string[];
}

const BASE = "/api/compliance/business";
const KEY = ["compliance", "business"] as const;

export const formatGbp = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n < 0 ? "-" : ""}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function useBusiness() {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<{ activities: Activity[]; budgets: BudgetSummary[] }>(BASE) });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: [...KEY, "budget", id],
    queryFn: () => apiRequest<{ budget: Budget }>(`${BASE}/budgets/${encodeURIComponent(id)}`).then((r) => r.budget),
  });
}

/** Business changes move calendar and dashboard items too. */
function useBusinessMutation<T, R>(fn: (payload: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["compliance", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "reminders"] });
    },
  });
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const json = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; code?: string; data?: T };
  if (!response.ok || json.success === false) throw new ApiError(json.message || "Upload failed.", response.status, json.code);
  return json.data as T;
}

export function useUpdateActivity() {
  return useBusinessMutation(({ key, ...body }: { key: string; everyMonths?: number | null; nextDue?: string | null; owner?: string; notes?: string }) =>
    apiRequest(`${BASE}/activities/${encodeURIComponent(key)}`, { method: "PATCH", body }),
  );
}

export function useAddBusinessRecord() {
  return useBusinessMutation(({ key, period, completedDate, summary, file }: { key: string; period: string; completedDate: string; summary: string; file: File | null }) => {
    const form = new FormData();
    form.append("period", period);
    form.append("completedDate", completedDate);
    form.append("summary", summary);
    if (file) form.append("file", file);
    return postForm(`${BASE}/activities/${encodeURIComponent(key)}/records`, form);
  });
}

export function useSignOffRecord() {
  return useBusinessMutation((id: string) => apiRequest(`${BASE}/records/${encodeURIComponent(id)}/sign-off`, { method: "POST" }));
}

export function useRemoveBusinessRecord() {
  return useBusinessMutation((id: string) => apiRequest(`${BASE}/records/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function downloadBusinessFile(record: BusinessRecord) {
  return downloadCsvExport(`${BASE}/records/${encodeURIComponent(record.id)}/file`, record.file?.name ?? "file");
}

export function useCreateBudget() {
  return useBusinessMutation((body: { name: string; startDate: string; thresholdPct: number | null; notes: string }) =>
    apiRequest<{ budget: { id: string } }>(`${BASE}/budgets`, { method: "POST", body }).then((r) => r.budget),
  );
}

export function useUpdateBudget(id: string) {
  return useBusinessMutation((body: { name?: string; startDate?: string; thresholdPct?: number | null; notes?: string }) =>
    apiRequest<{ budget: Budget }>(`${BASE}/budgets/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useSaveLines(id: string) {
  return useBusinessMutation((lines: LineInput[]) =>
    apiRequest<{ budget: Budget }>(`${BASE}/budgets/${encodeURIComponent(id)}/lines`, { method: "PUT", body: { lines } }).then((r) => r.budget),
  );
}

export function useSaveQuarter(id: string) {
  return useBusinessMutation(({ quarter, ...body }: { quarter: number; commentary: string; lineNotes: Record<string, string> }) =>
    apiRequest<{ budget: Budget }>(`${BASE}/budgets/${encodeURIComponent(id)}/quarters/${quarter}`, { method: "PATCH", body }),
  );
}

export function useSignOffQuarter(id: string) {
  return useBusinessMutation((quarter: number) =>
    apiRequest<{ budget: Budget }>(`${BASE}/budgets/${encodeURIComponent(id)}/quarters/${quarter}/sign-off`, { method: "POST" }),
  );
}

export function useDeleteBudget() {
  return useBusinessMutation((id: string) => apiRequest(`${BASE}/budgets/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function previewBudgetImport(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return postForm<{ rows: BudgetImportRow[] }>(`${BASE}/budgets/${encodeURIComponent(id)}/import/preview`, form);
}

export function useImportBudget(id: string) {
  return useBusinessMutation((file: File) => {
    const form = new FormData();
    form.append("file", file);
    return postForm<{ added: number; updated: number; skipped: number }>(`${BASE}/budgets/${encodeURIComponent(id)}/import`, form);
  });
}

export const downloadBudgetTemplate = () => downloadCsvExport(`${BASE}/budget-template`, "Budget template.xlsx");
export const exportBudget = (b: Pick<Budget, "id" | "name">) => downloadCsvExport(`${BASE}/budgets/${encodeURIComponent(b.id)}/export`, `Budget and variance ${b.name}.xlsx`);
export const downloadVarianceReport = (b: Pick<Budget, "id" | "name">, quarter: number) =>
  downloadCsvExport(`${BASE}/budgets/${encodeURIComponent(b.id)}/quarters/${quarter}/report`, `Variance report ${b.name} Q${quarter}.docx`);
