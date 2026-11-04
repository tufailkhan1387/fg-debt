import { useMemo, useState } from "react";
import { FileText, Search, Eye, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentItem } from "@/lib/solicitor-data";
import { downloadSolicitorDocumentRequest, verifyMatterDocumentRequest, useSolicitorMattersFull } from "@/lib/matters-api";
import { DocumentPreviewModal } from "@/components/solicitor/DocumentPreviewModal";
import { toast } from "sonner";

type MatterDocumentRow = DocumentItem & { matterId: string; clientName: string };

export function SolicitorDocumentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useSolicitorMattersFull();
  const initialDocs = useMemo(
    () =>
      (data?.matters ?? []).flatMap((m) =>
        m.documents.map((d) => ({ ...d, matterId: m.id, clientName: m.clientName })),
      ),
    [data?.matters],
  );

  const [docs, setDocs] = useState<MatterDocumentRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<MatterDocumentRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sourceDocs = docs.length > 0 ? docs : initialDocs;

  const filtered = sourceDocs.filter(
    (d) =>
      !query ||
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.clientName.toLowerCase().includes(query.toLowerCase()) ||
      d.matterId.toLowerCase().includes(query.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Could not load documents.</p>;
  }

  return (
    <div className="space-y-6 pb-12">
      <DocumentPreviewModal
        doc={selectedDoc}
        matterId={selectedDoc?.matterId}
        open={modalOpen}
        verifying={verifying}
        onClose={() => setModalOpen(false)}
        onDownload={
          selectedDoc
            ? () =>
                downloadSolicitorDocumentRequest(
                  selectedDoc.matterId,
                  selectedDoc.id,
                  selectedDoc.name,
                ).catch(() => toast.error("Could not download document."))
            : undefined
        }
        onStatusChange={async (id, status) => {
          const match = sourceDocs.find((doc) => doc.id === id);
          if (!match) return;
          setVerifying(true);
          try {
            await verifyMatterDocumentRequest(match.matterId, id, { status });
            await queryClient.invalidateQueries({ queryKey: ["solicitor", "matters", "full"] });
            setDocs((prev) => {
              const base = prev.length > 0 ? prev : initialDocs;
              return base.map((doc) =>
                doc.id === id
                  ? {
                      ...doc,
                      verificationStatus: status,
                      ocrStatus: status === "verified" ? "completed" : "needs_review",
                      confidenceScore: status === "verified" ? 96 : doc.confidenceScore,
                    }
                  : doc,
              );
            });
            toast.success(status === "verified" ? "Document verified" : "Document flagged", {
              description: match.name,
            });
            setModalOpen(false);
          } catch {
            toast.error("Could not update document status.");
          } finally {
            setVerifying(false);
          }
        }}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            Documents & OCR Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centralized document verification queue across all active client matters.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents or client..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Document Name</TableHead>
                <TableHead className="text-xs font-semibold">Client & Matter</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold">OCR Status</TableHead>
                <TableHead className="text-xs font-semibold">Verification</TableHead>
                <TableHead className="text-xs font-semibold">Confidence</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No documents found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((doc) => (
                  <TableRow key={`${doc.matterId}-${doc.id}`} className="text-xs group hover:bg-muted/50">
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        <span>{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{doc.clientName}</div>
                      <div className="text-[0.68rem] text-muted-foreground font-mono">{doc.matterId}</div>
                    </TableCell>
                    <TableCell className="capitalize">{doc.category.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                      {doc.ocrStatus}
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.verificationStatus === "verified" ? "default" : "secondary"} className="text-[0.62rem] capitalize">
                        {doc.verificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{doc.confidenceScore}%</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedDoc(doc);
                          setModalOpen(true);
                        }}
                        className="text-xs"
                      >
                        <Eye className="size-3.5 mr-1" /> Inspect & Verify
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
