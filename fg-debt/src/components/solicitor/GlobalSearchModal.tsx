import { useEffect, useState } from "react";
import { Search, FileText, User, ArrowRight, Loader2, StickyNote, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useSolicitorSearch } from "@/lib/search-api";

export function GlobalSearchModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const { data, isLoading, isFetching } = useSolicitorSearch(debouncedQuery, open);
  const matters = data?.matters ?? [];
  const documents = data?.documents ?? [];
  const notes = data?.notes ?? [];
  const audit = data?.audit ?? [];
  const showRecent = !debouncedQuery.trim();

  function openMatter(matterId: string) {
    onOpenChange(false);
    navigate({ to: `/solicitor/matters/${matterId}` as any });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden shadow-lift border-border bg-card">
        <DialogHeader className="p-4 border-b border-border/70 flex flex-row items-center gap-3 space-y-0">
          <Search className="size-5 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, matters, documents, notes... (Press Cmd+K anytime)"
            className="border-none shadow-none focus-visible:ring-0 text-base h-9 pl-0"
            autoFocus
          />
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <>
              {isFetching && !isLoading ? (
                <p className="text-[0.68rem] text-muted-foreground">Updating results…</p>
              ) : null}

              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5" /> {showRecent ? "Recent Matters" : "Clients & Matters"} ({matters.length})
                  </span>
                </div>
                {matters.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {showRecent ? "No matters in your caseload." : "No matching matters found."}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {matters.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => openMatter(m.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/70 transition-colors text-left group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{m.clientName}</span>
                            <span className="text-xs text-muted-foreground font-mono">{m.id}</span>
                            <Badge variant="outline" className="text-[0.65rem] capitalize">
                              {m.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Solution: <span className="font-medium text-foreground">{m.aiRecommendedSolution}</span> • Total Debt: £{m.totalDebt.toLocaleString()}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!showRecent ? (
                <>
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1.5"><FileText className="size-3.5" /> Scanned Documents ({documents.length})</span>
                    </div>
                    {documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No matching documents found.</p>
                    ) : (
                      <div className="space-y-1">
                        {documents.map((d) => (
                          <button
                            key={`${d.matterId}-${d.id}`}
                            onClick={() => openMatter(d.matterId)}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/70 transition-colors text-left group"
                          >
                            <div>
                              <span className="font-medium text-sm text-foreground">{d.name}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Client: {d.clientName} • OCR: <span className="capitalize">{d.ocrStatus}</span> ({d.confidenceScore}%)
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-[0.65rem]">{d.category}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1.5"><StickyNote className="size-3.5" /> Internal Notes ({notes.length})</span>
                    </div>
                    {notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No matching notes found.</p>
                    ) : (
                      <div className="space-y-1">
                        {notes.map((n) => (
                          <button
                            key={`${n.matterId}-${n.id}`}
                            onClick={() => openMatter(n.matterId)}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/70 transition-colors text-left group"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-foreground line-clamp-2">{n.content}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {n.author} • {n.clientName} • {n.date}
                              </p>
                            </div>
                            {n.isInternal ? (
                              <Badge variant="outline" className="text-[0.65rem] shrink-0 ml-2">Internal</Badge>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1.5"><History className="size-3.5" /> Audit Trail ({audit.length})</span>
                    </div>
                    {audit.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No matching audit entries found.</p>
                    ) : (
                      <div className="space-y-1">
                        {audit.map((a) => (
                          <button
                            key={`${a.matterId}-${a.id}`}
                            onClick={() => openMatter(a.matterId)}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/70 transition-colors text-left group"
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-sm text-foreground">{a.section}</span>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {a.newValue}{a.reason ? ` — ${a.reason}` : ""}
                              </p>
                              <p className="text-[0.68rem] text-muted-foreground mt-0.5">{a.clientName} • {a.timestamp}</p>
                            </div>
                            <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Type to search documents, internal notes, and audit entries across your caseload.</p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
