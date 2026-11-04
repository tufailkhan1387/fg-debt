import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Copy, Gift, Handshake, Share2, Users } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientPortal, useAcknowledgeReferral } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — FG Debt Advisor AI" },
      { name: "description", content: "Track specialist partner referrals made on your behalf and invite someone who needs debt support." },
      { property: "og:title", content: "Referrals — FG Debt Advisor AI" },
      { property: "og:description", content: "Partner referrals and invitations from your FG Debt Advisor AI account." },
    ],
  }),
  component: ReferralsPage,
});

const inviteLink = "https://aequita.co.uk/join?ref=AQ-2026-04417";

function ReferralsPage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;
  return <ReferralsContent portal={data.portal} />;
}

function ReferralsContent({ portal }: { portal: import("@/lib/client-portal-api").ClientPortalData }) {
  const [copied, setCopied] = useState(false);
  const acknowledgeReferral = useAcknowledgeReferral();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Invite link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please copy the link manually");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Partners & invitations"
        title="Referrals"
        description="Where we've connected you with a specialist partner, and how to invite someone who needs help."
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard icon={Handshake} label="Partner referrals" value={String(portal.referrals.length)} hint="Made on your behalf" tone="deep" />
        <StatCard icon={Users} label="People invited" value="2" hint="1 has started an assessment" />
        <StatCard icon={Gift} label="Support secured" value="£320" hint="Energy Trust grant applied" tone="positive" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Referral history</h2>
          <p className="text-sm text-muted-foreground">
            Referrals are only made with your consent and always to FCA or charity-regulated partners.
          </p>
          <ul className="mt-5 space-y-4">
            {portal.referrals.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No partner referrals yet. When your solicitor arranges specialist support, it will appear here.
              </li>
            ) : (
              portal.referrals.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-5 transition-colors hover:border-accent">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">{r.id}</p>
                      <h3 className="mt-1 text-base font-semibold">{r.partner}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
                    <span>Referred {r.date}</span>
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <ArrowRight className="size-3.5 text-accent" /> {r.next}
                    </span>
                  </div>
                  {!r.acknowledged && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acknowledgeReferral.isPending}
                        onClick={() =>
                          acknowledgeReferral.mutate(r.id, {
                            onSuccess: () => toast.success("Referral acknowledged."),
                            onError: () => toast.error("Could not acknowledge referral."),
                          })
                        }
                      >
                        I understand — acknowledge referral
                      </Button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <aside className="space-y-6">
          <section className="surface-card overflow-hidden">
            <div className="gradient-deep p-6 text-primary-foreground">
              <Share2 className="size-6 text-accent" />
              <h2 className="mt-4 font-display text-xl font-semibold">Invite someone you trust</h2>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
                Debt is easier to face with support. Share your personal link — their assessment is
                free and completely confidential.
              </p>
            </div>
            <div className="p-6">
              <label htmlFor="invite" className="text-xs font-semibold text-muted-foreground">
                Your invite link
              </label>
              <div className="mt-2 flex gap-2">
                <Input id="invite" readOnly value={inviteLink} className="text-xs" />
                <Button onClick={copy} variant="outline" size="icon" className="shrink-0" aria-label="Copy invite link">
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {copied ? "Copied to clipboard." : "No rewards, no pressure — just help when it's needed."}
              </p>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-sm font-semibold">How partner referrals work</h2>
            <ol className="mt-4 space-y-4">
              {[
                "Your solicitor identifies support beyond FG Debt Advisor AI's remit.",
                "You're asked to consent before any data is shared.",
                "The partner contacts you directly and we track the outcome here.",
              ].map((s, i) => (
                <li key={s} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
