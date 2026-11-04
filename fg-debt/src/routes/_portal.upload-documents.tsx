import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  CloudUpload,
  File as FileIcon,
  FileText,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";
import {
  type ClientPortalData,
  uploadDocumentRequest,
  useClientPortal,
} from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/upload-documents")({
  head: () => ({
    meta: [
      { title: "Upload Documents — FG Debt Advisor AI" },
      { name: "description", content: "Securely upload bank statements, payslips, benefit letters and creditor correspondence." },
      { property: "og:title", content: "Upload Documents — FG Debt Advisor AI" },
      { property: "og:description", content: "Drag and drop your supporting documents into your encrypted vault." },
    ],
  }),
  component: UploadPage,
});

type Pending = {
  id: number;
  name: string;
  size: string;
  progress: number;
  done: boolean;
  error?: string;
};

function UploadPage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;
  return <UploadContent portal={data.portal} />;
}

function UploadContent({ portal }: { portal: ClientPortalData }) {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [category, setCategory] = useState("bank_statement");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!portal.matterId) {
        toast.error("Assessment required", {
          description: "Complete and submit your debt assessment before uploading documents.",
        });
        return;
      }

      setUploading(true);
      const items: Pending[] = Array.from(files).map((f, i) => ({
        id: Date.now() + i,
        name: f.name,
        size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
        progress: 10,
        done: false,
      }));
      setPending((p) => [...items, ...p]);

      let hadError = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const item = items[i]!;
        try {
          setPending((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, progress: 45 } : x)),
          );
          await uploadDocumentRequest(file, category);
          setPending((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, progress: 100, done: true } : x)),
          );
        } catch (error) {
          hadError = true;
          const message = error instanceof ApiError ? error.message : "Upload failed.";
          setPending((prev) =>
            prev.map((x) => (x.id === item.id ? { ...x, progress: 100, error: message } : x)),
          );
          toast.error(`Could not upload ${file.name}`, { description: message });
        }
      }

      await invalidateClientDerivedQueries(queryClient);
      setUploading(false);
      if (!hadError) {
        toast.success("Upload complete", { description: "Your documents are queued for solicitor review." });
      }
    },
    [category, portal.matterId, queryClient],
  );

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Upload documents"
        description="Everything you upload is encrypted and only visible to you and your assigned solicitor. PDF, JPG or PNG up to 20 MB."
        actions={
          <Button onClick={() => inputRef.current?.click()} disabled={uploading || !portal.matterId}>
            <CloudUpload className="size-4" /> Select files
          </Button>
        }
      />

      {!portal.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment first so we can open your case and accept supporting documents.
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card p-5">
            <Label htmlFor="document-category">Document category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="document-category" className="mt-2">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {portal.documentCategories.map((item) => (
                  <SelectItem key={item.category} value={item.category}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-accent bg-accent/10" : "border-border bg-card"
            } ${!portal.matterId ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary/50 text-primary">
              <CloudUpload className="size-6" />
            </span>
            <p className="mt-4 font-display text-lg font-semibold">Drag & drop your files here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              or{" "}
              <button
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-foreground underline underline-offset-4"
                disabled={!portal.matterId}
              >
                browse from your device
              </button>
            </p>
          </div>

          {pending.length > 0 && (
            <section className="surface-card p-6">
              <h2 className="text-lg font-semibold">Uploading</h2>
              <ul className="mt-4 space-y-4">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary/50 text-primary">
                      {p.error ? (
                        <X className="size-5 text-destructive" />
                      ) : p.done ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : (
                        <FileIcon className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{p.size}</span>
                      </div>
                      <Progress value={p.progress} className="mt-2 h-1.5" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.error
                          ? p.error
                          : p.done
                            ? "Uploaded · awaiting review"
                            : `${Math.round(p.progress)}%`}
                      </p>
                    </div>
                    <button
                      onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                      aria-label={`Remove ${p.name}`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      {p.done || p.error ? <Trash2 className="size-4" /> : <X className="size-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-lg font-semibold">Uploaded documents</h2>
              <span className="text-xs text-muted-foreground">{portal.documents.length} files</span>
            </div>
            {portal.documents.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portal.documents.map((d) => (
                    <TableRow key={d.id} className="transition-colors hover:bg-muted/60">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileText className="size-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.size}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {d.type}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {d.date}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={d.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">What we still need</h2>
            <ul className="mt-4 space-y-4">
              {portal.documentCategories.map((c) => {
                const complete = c.required === 0 || c.uploaded >= c.required;
                return (
                  <li key={c.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.label}</span>
                      <span className={complete ? "text-success" : "text-warning"}>
                        {c.uploaded}/{c.required || c.uploaded}
                      </span>
                    </div>
                    <Progress
                      value={c.required === 0 ? 100 : Math.min(100, (c.uploaded / c.required) * 100)}
                      className="mt-2 h-1.5"
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-sm font-semibold">Upload tips</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li>· Include all pages — partial statements are rejected</li>
              <li>· Make sure your name and account number are visible</li>
              <li>· Photos must be in focus with all four corners in frame</li>
            </ul>
          </section>

          <section className="surface-card flex items-center gap-3 p-5">
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-accent" />
            ) : (
              <CheckCircle2 className="size-5 text-success" />
            )}
            <p className="text-sm text-muted-foreground">
              Documents are usually reviewed within 1 working day.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
