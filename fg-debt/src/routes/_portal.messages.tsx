import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Bot, CheckCheck, MessageSquare, SendHorizonal, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";
import {
  markClientMessagesReadRequest,
  sendClientMessageRequest,
  useClientPortal,
} from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { toast } from "sonner";

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

const notifIcon = { solicitor: ShieldCheck, system: Bell, ai: Bot };

function MessagesPage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;
  return <MessagesContent portal={data.portal} />;
}

function MessagesContent({ portal }: { portal: import("@/lib/client-portal-api").ClientPortalData }) {
  const queryClient = useQueryClient();
  const thread = portal.messageThread;
  const notifications = portal.notifications;
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!thread?.unreadCount) return;
    void markClientMessagesReadRequest()
      .then(() => invalidateClientDerivedQueries(queryClient))
      .catch(() => undefined);
  }, [queryClient, thread?.matterId, thread?.unreadCount]);

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await sendClientMessageRequest(reply.trim());
      setReply("");
      await invalidateClientDerivedQueries(queryClient);
      toast.success("Message sent", { description: "Your solicitor will be notified." });
    } catch (error) {
      toast.error("Could not send message", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
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
            {thread?.unreadCount ? ` (${thread.unreadCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="size-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          {!thread?.matterId ? (
            <section className="surface-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Submit your debt assessment to open secure messaging with your assigned solicitor.
              </p>
            </section>
          ) : (
            <section className="surface-card flex h-[560px] flex-col overflow-hidden">
              <header className="flex items-center gap-3 border-b border-border p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary/70 text-primary">
                  <UserRound className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{thread.adviser}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitor · {thread.matterId}
                  </p>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {thread.messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No messages yet. Send a secure message to your solicitor below.
                  </p>
                ) : (
                  thread.messages.map((message) => (
                    <div key={message.id} className={`flex ${message.mine ? "justify-end" : ""}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          message.mine
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm bg-secondary/60 text-foreground"
                        }`}
                      >
                        {!message.mine && (
                          <p className="mb-1 text-[0.65rem] font-semibold opacity-80">{message.author}</p>
                        )}
                        {message.content}
                        <p
                          className={`mt-1.5 text-[0.65rem] ${
                            message.mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {message.sentAt}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-end gap-2 border-t border-border p-4"
              >
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Write a secure message to your solicitor…"
                  className="resize-none"
                  aria-label="Message to solicitor"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-10 shrink-0"
                  disabled={sending || !reply.trim()}
                  aria-label="Send message"
                >
                  <SendHorizonal className="size-4" />
                </Button>
              </form>
            </section>
          )}
        </TabsContent>

        <TabsContent value="notifications">
          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-border p-5">
              <h2 className="text-lg font-semibold">All notifications</h2>
              <Button variant="ghost" size="sm">
                <CheckCheck className="size-4" /> Mark all as read
              </Button>
            </div>
            {notifications.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
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
                          <span className="text-xs text-muted-foreground">{n.time}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
