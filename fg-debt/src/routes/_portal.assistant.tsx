import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, FileUp, HelpCircle, Info, Loader2, SendHorizonal, Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useAssistantBootstrap, useAssistantChat } from "@/lib/client-assistant-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/assistant")({
  head: () => ({
    meta: [
      { title: "AI Adviser — FG Debt Advisor AI" },
      { name: "description", content: "Ask the FG Debt Advisor AI Adviser about debt terminology, your case status, documents and next steps." },
      { property: "og:title", content: "AI Adviser — FG Debt Advisor AI" },
      { property: "og:description", content: "A conversational AI Adviser for your debt advice journey." },
    ],
  }),
  component: AssistantPage,
});

type Msg = { id: number; role: "user" | "ai"; text: string };

function AssistantPage() {
  const bootstrapQuery = useAssistantBootstrap();
  const chatMutation = useAssistantChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [seeded, setSeeded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bootstrapQuery.data && !seeded) {
      setMessages([{ id: 1, role: "ai", text: bootstrapQuery.data.greeting }]);
      setSeeded(true);
    }
  }, [bootstrapQuery.data, seeded]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userId = Date.now();
    setMessages((current) => [...current, { id: userId, role: "user", text: trimmed }]);
    setInput("");

    chatMutation.mutate(trimmed, {
      onSuccess: (result) => {
        setMessages((current) => [
          ...current,
          { id: userId + 1, role: "ai", text: result.reply },
        ]);
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : "Could not reach the AI Adviser.";
        toast.error("Message failed", { description: message });
        setMessages((current) => [
          ...current,
          {
            id: userId + 1,
            role: "ai",
            text: "Sorry — I couldn't process that just now. Please try again or check your connection.",
          },
        ]);
      },
    });
  };

  if (bootstrapQuery.isLoading) return <ClientPortalLoading />;
  if (bootstrapQuery.isError || !bootstrapQuery.data) return <ClientPortalError />;

  const { suggestions, capabilities } = bootstrapQuery.data;

  return (
    <>
      <PageHeader
        eyebrow="AI Client Adviser"
        title="AI Adviser"
        description="Plain-English answers about your case, debt terminology and next steps."
      />

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-sm text-amber-950 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          <strong>Solicitor approval required for final legal advice.</strong> The AI Adviser can
          explain options, check documents and provide status updates, but only a regulated solicitor
          may approve and issue final legal advice.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="surface-card flex h-[640px] flex-col overflow-hidden">
          <header className="flex items-center gap-3 border-b border-border p-4">
            <span className="grid size-10 place-items-center rounded-xl gradient-deep text-accent">
              <Bot className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">FG Debt Advisor AI Adviser</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" /> Online
              </p>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                    message.role === "ai" ? "bg-secondary/60 text-primary" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {message.role === "ai" ? <Bot className="size-4" /> : <User className="size-4" />}
                </span>
                <div
                  className={`max-w-[78%] whitespace-pre-wrap text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
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
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  disabled={chatMutation.isPending}
                  className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {suggestion}
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
                disabled={chatMutation.isPending}
              />
              <Button
                type="submit"
                size="icon"
                className="size-10 shrink-0"
                aria-label="Send message"
                disabled={chatMutation.isPending || !input.trim()}
              >
                {chatMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizonal className="size-4" />
                )}
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
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => send(suggestion)}
                    disabled={chatMutation.isPending}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    {suggestion}
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
              {capabilities.map((capability) => (
                <li key={capability}>· {capability}</li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={chatMutation.isPending}
              onClick={() => send("Which documents are still missing?")}
            >
              <FileUp className="size-4" /> Check my documents
            </Button>
          </section>
        </aside>
      </div>
    </>
  );
}
