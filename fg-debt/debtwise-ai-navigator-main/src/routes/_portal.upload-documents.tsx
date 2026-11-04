import { createFileRoute } from "@tanstack/react-router";
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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { documents } from "@/lib/mock-data";
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

const categories = [
  { label: "Bank Statements", required: 3, uploaded: 3 },
  { label: "Payslips", required: 3, uploaded: 2 },
  { label: "Benefit Letters", required: 1, uploaded: 1 },
  { label: "Creditor Letters", required: 4, uploaded: 3 },
  { label: "Other Supporting", required: 0, uploaded: 1 },
];

type Pending = { id: number; name: string; size: string; progress: number; done: boolean };

function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items: Pending[] = Array.from(files).map((f, i) => ({
      id: Date.now() + i,
      name: f.name,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      progress: 0,
      done: false,
    }));
    setPending((p) => [...items, ...p]);
    items.forEach((item) => {
      const tick = setInterval(() => {
        setPending((prev) =>
          prev.map((x) => {
            if (x.id !== item.id) return x;
            const next = Math.min(100, x.progress + 12 + Math.random() * 18);
            if (next >= 100) {
              clearInterval(tick);
              return { ...x, progress: 100, done: true };
            }
            return { ...x, progress: next };
          }),
        );
      }, 260);
    });
    toast.success(`${items.length} file${items.length > 1 ? "s" : ""} uploading`);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Upload documents"
        description="Everything you upload is encrypted and only visible to you and your assigned solicitor. PDF, JPG or PNG up to 20 MB."
        actions={
          <Button onClick={() => inputRef.current?.click()}>
            <CloudUpload className="size-4" /> Select files
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-accent bg-accent/10" : "border-border bg-card"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
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
                      {p.done ? <CheckCircle2 className="size-5 text-success" /> : <FileIcon className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{p.size}</span>
                      </div>
                      <Progress value={p.progress} className="mt-2 h-1.5" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.done ? "Uploaded · awaiting review" : `${Math.round(p.progress)}%`}
                      </p>
                    </div>
                    <button
                      onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                      aria-label={`Remove ${p.name}`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      {p.done ? <Trash2 className="size-4" /> : <X className="size-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="text-lg font-semibold">Uploaded documents</h2>
              <span className="text-xs text-muted-foreground">{documents.length} files</span>
            </div>
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
                {documents.map((d) => (
                  <TableRow key={d.name} className="transition-colors hover:bg-muted/60">
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
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">What we still need</h2>
            <ul className="mt-4 space-y-4">
              {categories.map((c) => {
                const complete = c.required === 0 || c.uploaded >= c.required;
                return (
                  <li key={c.label}>
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
            <Loader2 className="size-5 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">
              Documents are usually reviewed within 1 working day.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
