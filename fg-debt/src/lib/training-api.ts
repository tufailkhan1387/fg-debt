import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export type RecordKind = "qualification" | "induction" | "appraisal" | "development" | "certificate";
export type RequirementStatus = "missing" | "overdue" | "due_soon" | "ok";

export const KIND_LABELS: Record<RecordKind, string> = {
  qualification: "Qualification",
  induction: "Induction",
  appraisal: "Performance evaluation",
  development: "Development objective",
  certificate: "Training certificate",
};

export const STATUS_LABELS: Record<RequirementStatus, string> = { missing: "Not done", overdue: "Overdue", due_soon: "Due soon", ok: "Up to date" };

export interface StaffSummary {
  id: string;
  name: string;
  position: string;
  startDate: string | null;
  supervisor: string;
  active: boolean;
  inductionRecorded: boolean;
  lastAppraisal: string | null;
  nextAppraisal: string | null;
  appraisalOverdue: boolean;
  trainingCount: number;
  hoursThisYear: number;
  missing: number;
  dueSoon: number;
  qualificationsExpiring: number;
}

export interface RequiredTraining {
  id: string;
  topic: string;
  positions: string[];
  everyMonths: number | null;
  notes: string;
}

export interface StaffRecord {
  id: string;
  kind: RecordKind;
  title: string;
  recordDate: string | null;
  dueDate: string | null;
  done: boolean;
  notes: string;
  file: { name: string; mime: string; size: number } | null;
  updatedBy: string;
  updatedAt: string;
  /** Appraisals only: the firm's structured appraisal form and its overall score (once all ten are rated). */
  form: AppraisalForm | null;
  score: number | null;
}

export interface AppraisalCategory {
  key: string;
  title: string;
  examples: string[];
}

export interface AppraisalRating {
  score: number;
  label: string;
  description: string;
}

export interface AppraisalForm {
  jobTitle: string;
  department: string;
  evaluationPeriod: string;
  goalsUpdated: boolean | null;
  goalsDate: string | null;
  complianceTrainingDone: boolean | null;
  complianceTrainingDate: string | null;
  ratings: Record<string, { score: number | null; comment: string }>;
  performancePlan: string;
  developmentNeeds: string;
  participation: string;
  employeeComments: string;
  employeeAgrees: "agree" | "disagree" | null;
}

export interface TrainingDone {
  id: string;
  ref: string;
  date: string | null;
  topic: string;
  provider: string;
  hours: number;
  evidence: string;
}

export interface RequirementCheck {
  requiredId: string;
  topic: string;
  everyMonths: number | null;
  status: RequirementStatus;
  lastCompleted: string | null;
  nextDue: string | null;
}

export interface StaffDetail extends StaffSummary {
  supervisionRequirements: string;
  records: StaffRecord[];
  training: TrainingDone[];
  requirements: RequirementCheck[];
  canSeeAppraisals: boolean;
}

export interface TrainingOverview {
  staff: StaffSummary[];
  required: RequiredTraining[];
  positions: string[];
  stats: { activeStaff: number; withMissingTraining: number; appraisalsOverdue: number; noInduction: number; hoursThisYear: number };
}

export interface StaffInput {
  name: string;
  position: string;
  startDate: string | null;
  supervisor: string;
  supervisionRequirements: string;
}

export interface RecordInput {
  kind: RecordKind;
  title: string;
  recordDate: string | null;
  dueDate: string | null;
  done: boolean;
  notes: string;
}

const BASE = "/api/compliance/training";
const KEY = ["compliance", "training"] as const;

export function useTraining() {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<TrainingOverview>(BASE) });
}

export function useStaff(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiRequest<{ staff: StaffDetail }>(`${BASE}/staff/${encodeURIComponent(id)}`).then((r) => r.staff),
  });
}

/** Training changes move calendar and dashboard figures too. */
function useTrainingMutation<T, R>(fn: (payload: T) => Promise<R>) {
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

export function useAddStaff() {
  return useTrainingMutation((body: StaffInput) => apiRequest<{ staff: { id: string } }>(`${BASE}/staff`, { method: "POST", body }).then((r) => r.staff));
}

export function useUpdateStaff(id: string) {
  return useTrainingMutation((body: Partial<StaffInput> & { active?: boolean }) =>
    apiRequest<{ staff: StaffDetail }>(`${BASE}/staff/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

/** Records go up as multipart so a certificate file can travel with them. */
export function useAddRecord(staffId: string) {
  return useTrainingMutation(async ({ input, file }: { input: RecordInput; file: File | null }) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
    const form = new FormData();
    for (const [key, value] of Object.entries(input)) form.append(key, value === null ? "" : String(value));
    if (file) form.append("file", file);
    const response = await fetch(`${API_URL}${BASE}/staff/${encodeURIComponent(staffId)}/records`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; code?: string; data?: { staff: StaffDetail } };
    if (!response.ok || json.success === false) throw new ApiError(json.message || "Could not save the record.", response.status, json.code);
    return json.data?.staff ?? null;
  });
}

export function useUpdateRecord() {
  return useTrainingMutation(({ id, ...body }: { id: string } & Partial<Omit<RecordInput, "kind">>) =>
    apiRequest(`${BASE}/records/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useRemoveRecord() {
  return useTrainingMutation((id: string) => apiRequest(`${BASE}/records/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function useAddRequired() {
  return useTrainingMutation((body: Omit<RequiredTraining, "id">) => apiRequest(`${BASE}/required`, { method: "POST", body }));
}

export function useUpdateRequired() {
  return useTrainingMutation(({ id, ...body }: RequiredTraining) => apiRequest(`${BASE}/required/${encodeURIComponent(id)}`, { method: "PATCH", body }));
}

export function useRemoveRequired() {
  return useTrainingMutation((id: string) => apiRequest(`${BASE}/required/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function useAppraisalFormDefinition() {
  return useQuery({
    queryKey: [...KEY, "appraisal-form"],
    queryFn: () => apiRequest<{ categories: AppraisalCategory[]; ratings: AppraisalRating[]; scoresNeedingComment: number[] }>(`${BASE}/appraisal-form`),
    staleTime: Infinity,
  });
}

export function useSaveAppraisalForm() {
  return useTrainingMutation(({ id, form }: { id: string; form: AppraisalForm }) =>
    apiRequest(`${BASE}/records/${encodeURIComponent(id)}/form`, { method: "PUT", body: form }),
  );
}

export function downloadAppraisalForm(record: StaffRecord, staffName: string) {
  return downloadCsvExport(`${BASE}/records/${encodeURIComponent(record.id)}/appraisal-report`, `Performance evaluation ${staffName} ${record.recordDate ?? ""}.docx`.replace(" .docx", ".docx"));
}

export function downloadRecordFile(record: StaffRecord) {
  return downloadCsvExport(`${BASE}/records/${encodeURIComponent(record.id)}/file`, record.file?.name ?? "file");
}

export function downloadCompetenceReport(staff: Pick<StaffSummary, "id" | "name">, year: string) {
  return downloadCsvExport(`${BASE}/staff/${encodeURIComponent(staff.id)}/report?year=${year}`, `Competence record ${staff.name} ${year}.docx`);
}

export function downloadTrainingSummary(year: string) {
  return downloadCsvExport(`${BASE}/report?year=${year}`, `Training and competence summary ${year}.docx`);
}
