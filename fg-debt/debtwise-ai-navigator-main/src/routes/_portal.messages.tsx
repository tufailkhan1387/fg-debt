import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Bot, CheckCheck, MessageSquare, SendHorizonal, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { messages, notifications } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/messages")({
  head: () => ({
    meta: [
      { title: "Messages & Notifications — FG Debt Advisor AI" },
      { name: "description", content: "Secure messages from your solicitor and case team, plus every notification about your debt case." },
      { property: "og:title", content: "Messages & Notifications — FG Debt Advisor AI" },
      { property: "og:description", content: "Your secure inbox and case notifications." },
    ],
  }),
  component: MessagesPage,
});

type Thread = { id: number; from: string; body: string; time: string; mine?: boolean };

const threadBodies: Record<number, Thread[]> = {
  1: [
    {
      id: 1,
      from: "R. Okonkwo",
      time: "09:31",
      body: "Good morning Amelia — I've started reviewing your assessment. Everything looks consistent so far.",
    },
    {
      id: 2,
      from: "R. Okonkwo",
      time: "09:42",
      body: "One clarification: your childcare costs of £180 per month — is that ongoing through the summer, or term-time only? It affects the disposable income calculation.",
    },
  ],
  2: [
    { id: 1, from: "FG Debt Advisor AI", time: "Mon 08:00", body: "Your weekly case summary is ready. Progress moved from 68% to 82% and two documents were verified." },
  ],
  3: [
    { id: 1, from: "Case Operations", time: "12 Jun", body: "Thanks for uploading your creditor letters — all three are readable and now attached to CASE-1042." },
  ],
};

const notifIcon = { solicitor: ShieldCheck, system: Bell, ai: Bot };

function MessagesPage() {
  const [activeId, setActiveId] = useState(messages[0]!.id);
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState<Thread[]>([]);
  const active = messages.find((m) => m.id === activeId)!;
  const thread = [...(threadBodies[activeId] ?? []), ...sent.filter(() => true)];

  const send = () => {
    if (!reply.trim()) return;
    setSent((s) => [
      ...s,
      { id: Date.now(), from: "You", time: "Just now", body: reply.trim(), mine: true },
    ]);
    setReply("");
  };

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Messages & notifications"
        description="Encrypted correspondence with your case team, and a running log of everything that happens on your case."
      />

      <Tabs defaultValue="messages">
        <TabsList className="mb-6">
          <TabsTrigger value="messages">
            <MessageSquare className="size-4" /> Messages
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <ul className="surface-card divide-y divide-border overflow-hidden p-0">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => {
                      setActiveId(m.id);
                      setSent([]);
                    }}
                    aria-pressed={activeId === m.id}
                    className={`w-full p-4 text-left transition-colors hover:bg-muted/60 ${
                      activeId === m.id ? "bg-accent/12" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{m.from}</p>
                      <span className="text-[0.68rem] text-muted-foreground">{m.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {m.preview}
                    </p>
                    {m.unread && (
                      <span className="mt-2 inline-block rounded-full bg-accent/25 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                        Unread
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <section className="surface-card flex h-[560px] flex-col overflow-hidden">
              <header className="flex items-center gap-3 border-b border-border p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary/70 text-primary">
                  <UserRound className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{active.from}</p>
                  <p className="text-xs text-muted-foreground">{active.role} · CASE-1042</p>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {thread.map((t) => (
                  <div key={t.id} className={`flex ${t.mine ? "justify-end" : ""}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        t.mine
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm bg-secondary/60 text-foreground"
                      }`}
                    >
                      {t.body}
                      <p
                        className={`mt-1.5 text-[0.65rem] ${
                          t.mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {t.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2 border-t border-border p-4"
              >
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Write a secure reply…"
                  className="resize-none"
                  aria-label="Reply message"
                />
                <Button type="submit" size="icon" className="size-10 shrink-0" aria-label="Send reply">
                  <SendHorizonal className="size-4" />
                </Button>
              </form>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-border p-5">
              <h2 className="text-lg font-semibold">All notifications</h2>
              <Button variant="ghost" size="sm">
                <CheckCheck className="size-4" /> Mark all as read
              </Button>
            </div>
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const Icon = notifIcon[n.kind];
                return (
                  <li key={n.id} className={`flex gap-4 p-5 ${n.unread ? "bg-accent/8" : ""}`}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/70 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{n.title}</p>
                        <span className="text-xs text-muted-foreground">{n.time} ago</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
