import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, FileUp, HelpCircle, SendHorizonal, Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_portal/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — FG Debt Advisor AI" },
      { name: "description", content: "Ask the FG Debt Advisor AI assistant about debt terminology, your case status, documents and next steps." },
      { property: "og:title", content: "AI Assistant — FG Debt Advisor AI" },
      { property: "og:description", content: "A conversational assistant for your debt advice journey." },
    ],
  }),
  component: AssistantPage,
});

type Msg = { id: number; role: "user" | "ai"; text: string };

const seed: Msg[] = [
  {
    id: 1,
    role: "ai",
    text: "Hello Amelia — I'm the FG Debt Advisor AI assistant. I can explain debt terminology, check your case status, remind you what's outstanding and help with uploads. What would you like to know?",
  },
];

const suggestions = [
  "What is a Debt Relief Order?",
  "What's the status of my case?",
  "Which documents are still missing?",
  "What happens if my income changes?",
  "Explain priority vs non-priority debts",
];

const canned: { match: RegExp; reply: string }[] = [
  {
    match: /dro|debt relief order/i,
    reply:
      "A Debt Relief Order freezes qualifying debts for 12 months. If your circumstances don't improve during that time, the debts are written off. It suits people with low income, minimal assets and under £50,000 of unsecured debt — which matches your current assessment.",
  },
  {
    match: /status|progress|case/i,
    reply:
      "Your case CASE-1042 is at 82% and currently sitting with R. Okonkwo for solicitor review. Reviews usually complete within 48 hours, and you'll get a notification the moment the outcome is ready.",
  },
  {
    match: /document|upload|missing/i,
    reply:
      "You still owe us one payslip (June 2026) and one creditor letter from Orbit Catalogue. Head to Upload Documents and drag them in — I'll check they're readable straight away.",
  },
  {
    match: /priority|non-priority/i,
    reply:
      "Priority debts carry the most serious consequences if unpaid — council tax, rent, energy, court fines. Non-priority debts, such as credit cards and catalogues, can't take your home or liberty but may still lead to a CCJ.",
  },
  {
    match: /income|change/i,
    reply:
      "If your income rises above the DRO threshold during the moratorium you must tell the Official Receiver. Your solicitor will explain the reporting duties before anything is submitted.",
  },
];

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { id: Date.now(), role: "user", text: trimmed }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const hit = canned.find((c) => c.match.test(trimmed));
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "ai",
          text:
            hit?.reply ??
            "I've noted that. While a solicitor has the final say on any solution, I can walk you through the process, explain any term in plain English or check what's outstanding on your case. Would you like a summary of your next steps?",
        },
      ]);
      setTyping(false);
    }, 900);
  };

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="FG Debt Advisor AI"
        description="Plain-English answers about your case, debt terminology and next steps. The assistant cannot approve solutions — that's always a solicitor's decision."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="surface-card flex h-[640px] flex-col overflow-hidden">
          <header className="flex items-center gap-3 border-b border-border p-4">
            <span className="grid size-10 place-items-center rounded-xl gradient-deep text-accent">
              <Bot className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">FG Debt Advisor AI Assistant</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" /> Online
              </p>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                    m.role === "ai" ? "bg-secondary/60 text-primary" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {m.role === "ai" ? <Bot className="size-4" /> : <User className="size-4" />}
                </span>
                <div
                  className={`max-w-[78%] text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-secondary/60 text-primary">
                  <Bot className="size-4" />
                </span>
                <div className="flex items-center gap-1 pt-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:bg-accent/10"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                placeholder="Ask about your case, a document or any debt term…"
                className="resize-none"
              />
              <Button type="submit" size="icon" className="size-10 shrink-0" aria-label="Send message">
                <SendHorizonal className="size-4" />
              </Button>
            </form>
            <p className="mt-2 text-[0.68rem] text-muted-foreground">
              AI responses are informational only and subject to solicitor approval.
            </p>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-accent" /> Suggested questions
            </h2>
            <ul className="mt-3 space-y-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => send(s)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-accent hover:bg-accent/10"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="size-4 text-accent" /> The assistant can
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· Explain debt terminology in plain English</li>
              <li>· Check your application status</li>
              <li>· Remind you what's outstanding</li>
              <li>· Guide you through document uploads</li>
            </ul>
            <Button variant="outline" className="mt-4 w-full" onClick={() => send("Which documents are still missing?")}>
              <FileUp className="size-4" /> Check my documents
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
