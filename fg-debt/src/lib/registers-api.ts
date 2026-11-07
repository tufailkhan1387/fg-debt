import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export type FieldType = "text" | "longtext" | "date" | "number" | "select" | "person";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
}

export interface RegisterDef {
  key: string;
  title: string;
  description: string;
  section: string;
  sensitive: boolean;
  importable: boolean;
  fields: FieldDef[];
  columns: string[];
  dateField: string | null;
  status: { field: string; closed: string[] } | null;
  due: { field: string; label: string } | null;
  /** The tests/scenarios entries refer to (e.g. the BCP "Typical Tests"), shown above the register. */
  scenarios: { heading: string; items: Array<{ title: string; scenario: string; checks: string[]; expected: string }> } | null;
}

export interface RegisterSummary {
  key: string;
  title: string;
  description: string;
  section: string;
  sensitive: boolean;
  importable: boolean;
  count: number;
  open: number | null;
  nil: number;
  lastEntryDate: string | null;
}

export type EntryData = Record<string, string | number | null>;

export interface RegisterEntry {
  id: string;
  ref: string;
  data: EntryData;
  isNil: boolean;
  nilPeriod: string | null;
  nilNote: string | null;
  open: boolean | null;
  restricted: boolean;
  allowedUserIds: string[];
  canRestrict: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface ImportRow {
  rowNumber: number;
  data: EntryData;
  isNil: boolean;
  nilPeriod: string | null;
  nilNote: string | null;
  action: "new" | "exists" | "invalid";
  issues: string[];
  warnings: string[];
}

const BASE = "/api/compliance/registers";
const KEY = ["compliance", "registers"] as const;

export function useRegisters() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiRequest<{ catalog: RegisterDef[]; registers: RegisterSummary[] }>(BASE),
  });
}

export function useRegisterEntries(key: string) {
  return useQuery({
    queryKey: [...KEY, key],
    queryFn: () => apiRequest<{ entries: RegisterEntry[] }>(`${BASE}/${encodeURIComponent(key)}/entries`).then((r) => r.entries),
  });
}

/** Register changes also move dashboard and calendar figures. */
function useRegisterMutation<T, R>(fn: (payload: T) => Promise<R>) {
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

export function useAddEntry(key: string) {
  return useRegisterMutation((body: { data: EntryData; restricted?: boolean; allowedUserIds?: string[] }) =>
    apiRequest<{ entry: RegisterEntry }>(`${BASE}/${encodeURIComponent(key)}/entries`, { method: "POST", body }).then((r) => r.entry),
  );
}

export function useAddNil(key: string) {
  return useRegisterMutation((body: { period: string; note: string }) =>
    apiRequest<{ entry: RegisterEntry }>(`${BASE}/${encodeURIComponent(key)}/nil`, { method: "POST", body }).then((r) => r.entry),
  );
}

export function useUpdateEntry() {
  return useRegisterMutation(
    ({ id, ...body }: { id: string; data?: EntryData; restricted?: boolean; allowedUserIds?: string[]; nilPeriod?: string; nilNote?: string }) =>
      apiRequest<{ entry: RegisterEntry }>(`${BASE}/entries/${encodeURIComponent(id)}`, { method: "PATCH", body }).then((r) => r.entry),
  );
}

export function useReviewEntry() {
  return useRegisterMutation((id: string) =>
    apiRequest<{ entry: RegisterEntry }>(`${BASE}/entries/${encodeURIComponent(id)}/review`, { method: "POST" }).then((r) => r.entry),
  );
}

export function useRemoveEntry() {
  return useRegisterMutation((id: string) => apiRequest<{ removed: true }>(`${BASE}/entries/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

async function postFile<T>(path: string, file: File): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const json = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; code?: string; data?: T };
  if (!response.ok || json.success === false) throw new ApiError(json.message || "Upload failed.", response.status, json.code);
  return json.data as T;
}

export function previewRegisterImport(key: string, file: File) {
  return postFile<{ sheet: string; rows: ImportRow[] }>(`${BASE}/${encodeURIComponent(key)}/import/preview`, file);
}

export function useImportRegister(key: string) {
  return useRegisterMutation((file: File) =>
    postFile<{ sheet: string; imported: number; skippedExisting: number; skippedInvalid: number }>(`${BASE}/${encodeURIComponent(key)}/import`, file),
  );
}

export function exportRegister(def: RegisterDef) {
  return downloadCsvExport(`${BASE}/${encodeURIComponent(def.key)}/export`, `${def.title} register ${new Date().toISOString().slice(0, 10)}.xlsx`);
}
