import { Link } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Bot,
  CalendarCheck,
  CircleHelp,
  FileSearch,
  FileWarning,
  HelpCircle,
  Loader2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import { useClientAdviserSection, AI_CLIENT_ADVISER_SECTIONS, type AiClientAdviserSection } from "@/lib/client-adviser-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export { AI_CLIENT_ADVISER_SECTIONS, type AiClientAdviserSection } from "@/lib/client-adviser-api";

const sectionIcons: Record<AiClientAdviserSection, LucideIcon> = {
  "explain-debt-options": BookOpen,
  "explain-terminology": CircleHelp,
  "answer-common-questions": HelpCircle,
  "check-uploaded-documents": FileSearch,
  "request-missing-evidence": FileWarning,
  "prepare-client-for-appointments": CalendarCheck,
  "provide-status-updates": Activity,
};

export function isAiClientAdviserSection(value: string): value is AiClientAdviserSection {
  return AI_CLIENT_ADVISER_SECTIONS.includes(value as AiClientAdviserSection);
}

export function AiClientAdviserPage({ section }: { section: AiClientAdviserSection }) {
  const { data, isLoading, isError } = useClientAdviserSection(section);
  const Icon = sectionIcons[section];

  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  return (
    <>
      <PageHeader
        eyebrow="AI Client Adviser"
        title={data.title}
        description={data.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/assistant">
              <Bot className="size-4" /> Open AI Adviser chat
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Icon}
          label={data.title}
          value={data.statValue}
          hint={data.statHint}
          tone={data.statTone}
        />
        <StatCard
          icon={ShieldCheck}
          label="Advice status"
          value={data.adviceStatus}
          hint={data.adviceHint}
        />
        <StatCard
          icon={Bot}
          label="AI Client Adviser"
          value="Active"
          hint="Human-in-the-loop"
          tone="positive"
        />
      </div>

      <section className="surface-card mt-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">{data.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Support provided by the AI Client Adviser. Formal advice remains solicitor-gated.
          </p>
        </div>

        {data.bullets.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            Loading guidance…
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {data.bullets.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        )}

        {data.relatedTo && data.relatedLabel && (
          <div className="mt-5">
            <Button asChild>
              <Link to={data.relatedTo as "/"}>{data.relatedLabel}</Link>
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
