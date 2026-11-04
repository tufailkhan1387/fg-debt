import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bot, Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { useAsk, useAssistant, useConversation, useDeleteConversation, type AssistantMessage, type AssistantSource } from "@/lib/assistant-api";

/** Questions from spec section 13, to start from. */
const EXAMPLES = [
  "Are we ready for our SQM audit?",
  "What compliance documents are missing?",
  "Which policies need reviewing?",
  "What corrective actions are outstanding?",
  "Prepare our annual risk assessment.",
  "Review our Complaints Procedure.",
];

export function AssistantPage() {
  return (
    <PrincipalGate message="The AI Compliance Assistant is for the firm's Principal, because it reads every area of the firm's records.">
      <Assistant />
    </PrincipalGate>
  );
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

/** Bold text and [P3]-style references inside one line. */
function inline(text: string, sources: Map<string, AssistantSource>, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[A-Z]\d{1,4}\])/g).map((part, i) => {
    const k = `${key}-${i}`;
    const ref = /^\[([A-Z]\d{1,4})\]$/.exec(part)?.[1];
    if (ref) {
      const source = sources.get(ref);
      if (source) {
        return (
          <Link key={k} to={source.link as "/"} title={source.label} className="mx-0.5 inline-flex items-center rounded bg-primary/10 px-1 font-mono text-[0.7rem] font-semibold text-primary hover:underline">
            {ref}
          </Link>
        );
      }
      return (
        <span key={k} title="This reference did not match any record the assistant was shown" className="mx-0.5 rounded bg-rose-500/15 px-1 font-mono text-[0.7rem] font-semibold text-rose-700 dark:text-rose-300">
          {ref}?
        </span>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={k}>{part.slice(2, -2)}</strong>;
    return <Fragment key={k}>{part}</Fragment>;
  });
}

/** A small, safe renderer for the assistant's plain-text answers: headings, bullet and numbered lists, paragraphs. */
function Answer({ message }: { message: AssistantMessage }) {
  const sources = new Map(message.sources.map((s) => [s.ref, s]));
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;
  const flush = () => {
    if (!list) return;
    blocks.push(list.ordered ? <ol key={`l${blocks.length}`} className="ml-5 list-decimal space-y-1">{list.items}</ol> : <ul key={`l${blocks.length}`} className="ml-5 list-disc space-y-1">{list.items}</ul>);
    list = null;
  };
  message.content.split(/\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line) ?? (/^(Information missing)\s*:?$/i.exec(line.trim()) ? [line, line.trim().replace(/:$/, "")] : null);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(<li key={`i${i}`}>{inline((bullet ?? numbered)![1]!, sources, `i${i}`)}</li>);
      return;
    }
    flush();
    if (!line.trim()) return;
    if (heading) blocks.push(<p key={`h${i}`} className="pt-1 font-semibold">{inline(heading[1]!, sources, `h${i}`)}</p>);
    else blocks.push(<p key={`p${i}`}>{inline(line, sources, `p${i}`)}</p>);
  });
  flush();
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

function Assistant() {
  const overview = useAssistant();
  const ask = useAsk();
  const remove = useDeleteConversation();
  const [active, setActive] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const conversation = useConversation(active);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation.data?.messages.length, pending]);

  if (overview.isLoading) return <SolicitorDataLoading label="Loading the assistant…" />;
  if (overview.isError || !overview.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load the assistant.</p>;
  const { status, conversations } = overview.data;

  const send = (text: string) => {
    const q = text.trim();
    if (q.length < 2 || ask.isPending) return;
    setPending(q);
    setQuestion("");
    ask.mutate(
      { conversationId: active, question: q },
      {
        onSuccess: (r) => setActive(r.conversationId),
        onError: (error) => {
          toast.error("No answer", { description: errorMessage(error) });
          setQuestion(q);
        },
        onSettled: () => setPending(null),
      },
    );
  };

  const messages = active ? (conversation.data?.messages ?? []) : [];

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">AI Compliance Assistant</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ask about the firm's compliance in plain English. Answers come from the firm's records, with a link to each record
          relied on, and say what information is missing. The assistant suggests; you decide.
        </p>
      </div>

      {!status.configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> The assistant is not switched on yet: it needs the AI provider's API key in the server settings.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="surface-card min-w-0">
          <CardContent className="space-y-2 p-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setActive(null)}>
              <MessageSquarePlus className="size-4" /> New question
            </Button>
            {conversations.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No conversations yet.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id} className={`group flex items-center gap-1 rounded-md ${active === c.id ? "bg-muted" : "hover:bg-muted/60"}`}>
                    <button type="button" className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm" onClick={() => setActive(c.id)} title={c.title}>
                      {c.title}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete conversation"
                      className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                      onClick={() =>
                        remove.mutate(c.id, {
                          onSuccess: () => active === c.id && setActive(null),
                          onError: (error) => toast.error("Not deleted", { description: errorMessage(error) }),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card min-w-0">
          <CardContent className="flex min-h-[60vh] flex-col gap-4 p-4">
            <div className="flex-1 space-y-4">
              {!active && !pending && (
                <div className="space-y-3 py-6 text-center">
                  <Bot className="mx-auto size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Try one of these, or ask your own question.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((e) => (
                      <button key={e} type="button" disabled={!status.configured || ask.isPending} onClick={() => send(e)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {active && conversation.isLoading && <SolicitorDataLoading label="Loading the conversation…" />}
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div key={m.id} className="space-y-2 rounded-lg border bg-muted/30 px-4 py-3">
                    <Answer message={m} />
                    {m.sources.length > 0 && (
                      <div className="border-t pt-2 text-xs text-muted-foreground">
                        <span className="font-semibold">Records relied on: </span>
                        {m.sources.map((s, i) => (
                          <Fragment key={s.ref}>
                            {i > 0 && " · "}
                            <Link to={s.link as "/"} className="text-primary hover:underline">
                              {s.ref} {s.label}
                            </Link>
                          </Fragment>
                        ))}
                      </div>
                    )}
                    {m.unknownRefs.length > 0 && (
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        {m.unknownRefs.join(", ")}: the assistant cited {m.unknownRefs.length === 1 ? "a reference" : "references"} that match no record it was shown. Treat those points with care.
                      </p>
                    )}
                  </div>
                ),
              )}
              {pending && (
                <>
                  <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{pending}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Reading the firm's records…
                  </div>
                </>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(question);
              }}
              className="flex items-end gap-2 border-t pt-3"
            >
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(question);
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder={status.configured ? "Ask about the firm's compliance…" : "The assistant is not switched on yet."}
                disabled={!status.configured || ask.isPending}
                aria-label="Your question"
                className="min-h-0 flex-1 resize-none"
              />
              <Button type="submit" disabled={!status.configured || ask.isPending || question.trim().length < 2}>
                {ask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Ask
              </Button>
            </form>
            <p className="text-[0.7rem] text-muted-foreground">
              Uses {status.provider}. Personal details such as emails and phone numbers are removed before records are sent;
              restricted records are never sent. AI answers can be wrong: check the linked records before acting.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
