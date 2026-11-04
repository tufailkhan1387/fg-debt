import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { MatterReviewPage } from "@/components/solicitor/pages/MatterReviewPage";
import { SolicitorSectionPage } from "@/components/solicitor/pages/SolicitorSectionPage";
import { pickPrimaryReviewMatter, useSolicitorMattersFull } from "@/lib/matters-api";
import { solicitorNav } from "@/lib/solicitor-nav";

const REVIEW_TAB_BY_SECTION: Record<string, string> = {
  overview: "overview",
  "financial-statement": "financial",
  "debt-review": "debts",
  "vulnerability-review": "vulnerabilities",
  "risk-review": "risks",
  "ai-recommendation": "ai_rec",
  decision: "ai_rec",
};

function normalizeSplat(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function resolveSplat(pathname: string, params: Record<string, string | undefined>) {
  const fromParams = normalizeSplat(params._splat ?? params["*"] ?? "");
  if (fromParams) return fromParams;
  return normalizeSplat(pathname.replace(/^\/solicitor\/?/, ""));
}

function titleForSplat(splat: string) {
  const path = `/solicitor/${normalizeSplat(splat)}`;
  const item = solicitorNav.flatMap((g) => g.items).find((i) => i.to === path);
  return item?.label ?? "Solicitor";
}

export const Route = createFileRoute("/_solicitor/solicitor/$")({
  head: ({ params }) => {
    const p = params as Record<string, string | undefined>;
    const splat = normalizeSplat(p._splat ?? p["*"] ?? "");
    return {
      meta: [{ title: `${titleForSplat(splat)} — Solicitor Dashboard` }],
    };
  },
  component: SolicitorSplatPage,
});

function ReviewSectionPage({ section }: { section: string }) {
  const { data, isLoading, isError } = useSolicitorMattersFull();
  const tab = REVIEW_TAB_BY_SECTION[section] ?? "overview";
  const matter = pickPrimaryReviewMatter(data?.matters);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isError || !matter) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No review matter available.</p>;
  }

  return <MatterReviewPage matterIdOverride={matter.id} defaultTab={tab} />;
}

function SolicitorSplatPage() {
  const params = Route.useParams() as Record<string, string | undefined>;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const splat = resolveSplat(pathname, params);

  if (splat.startsWith("review/") || splat === "review") {
    const section = splat === "review" ? "overview" : splat.slice("review/".length);
    return <ReviewSectionPage section={section} />;
  }

  return <SolicitorSectionPage splat={splat} />;
}
