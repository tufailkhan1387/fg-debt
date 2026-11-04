import { FileText, AlertTriangle, Eye, Download, ShieldCheck, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentItem } from "@/lib/solicitor-data";
import { toast } from "sonner";

export function DocumentPreviewModal({
  doc,
  matterId,
  open,
  verifying = false,
  onClose,
  onStatusChange,
  onDownload,
}: {
  doc: DocumentItem | null;
  matterId?: string;
  open: boolean;
  verifying?: boolean;
  onClose: () => void;
  onStatusChange?: (docId: string, status: "verified" | "flagged") => void | Promise<void>;
  onDownload?: () => void | Promise<void>;
}) {
  if (!doc) return null;

  const canDownload = Boolean(matterId && doc.id && onDownload);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto shadow-lift border-border bg-card p-6">
        <DialogHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-display">{doc.name}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Category: <span className="font-semibold text-foreground capitalize">{doc.category.replace(/_/g, " ")}</span> • Size: {doc.size} • Version {doc.version}
                  {matterId ? ` • ${matterId}` : ""}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={doc.verificationStatus === "verified" ? "default" : doc.verificationStatus === "flagged" ? "destructive" : "secondary"}
                className="capitalize"
              >
                {doc.verificationStatus}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="rounded-xl border border-border bg-muted/40 p-5 flex flex-col items-center justify-center min-h-[320px] text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 pointer-events-none" />
            <FileText className="size-16 text-muted-foreground/40 mb-3 group-hover:scale-105 transition-transform" />
            <h4 className="font-semibold text-sm text-foreground">{doc.name}</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Uploaded on {doc.uploadedAt}
            </p>
            <div className="mt-4 flex items-center gap-2 relative z-10">
              <Button
                size="sm"
                variant="outline"
                disabled={!canDownload}
                onClick={() => {
                  if (!canDownload) {
                    toast.info("Download is only available for uploaded client documents.");
                    return;
                  }
                  void onDownload?.();
                }}
              >
                <Eye className="size-3.5 mr-1" /> Preview
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!canDownload}
                onClick={() => {
                  if (!canDownload) {
                    toast.info("Download is only available for uploaded client documents.");
                    return;
                  }
                  void onDownload?.();
                }}
              >
                <Download className="size-3.5 mr-1" /> Download
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>OCR Scanning Metrics</span>
                <Badge variant="outline" className="text-[0.65rem] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  {doc.confidenceScore}% Confidence
                </Badge>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Processing Engine</span>
                  <span className="font-medium">FG Debt OCR</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Scan Date</span>
                  <span className="font-medium">{doc.uploadedAt}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">OCR Status</span>
                  <span className="font-semibold capitalize text-emerald-600 dark:text-emerald-400">{doc.ocrStatus.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Verification Flag</span>
                  <span className="font-medium capitalize">{doc.verificationStatus}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Extracted Data Fields
              </h4>
              <div className="space-y-2">
                {Object.entries(doc.extractedInfo || {}).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No extracted fields yet.</p>
                ) : (
                  Object.entries(doc.extractedInfo || {}).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs">
                      <span className="text-muted-foreground font-medium">{key}</span>
                      <span className="font-semibold text-foreground font-mono">{val}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="default"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={verifying || doc.verificationStatus === "verified"}
                onClick={() => {
                  void onStatusChange?.(doc.id, "verified");
                }}
              >
                {verifying ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4 mr-1.5" />
                )}
                Verify Document
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-rose-500/50 text-rose-600 hover:bg-rose-500/10"
                disabled={verifying}
                onClick={() => {
                  void onStatusChange?.(doc.id, "flagged");
                }}
              >
                <AlertTriangle className="size-4 mr-1.5" /> Flag Issue
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
