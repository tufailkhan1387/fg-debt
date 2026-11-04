import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  Bell,
  BookOpen,
  Calculator,
  CalendarCheck,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Download,
  FileSearch,
  FileStack,
  FileWarning,
  Flag,
  Gauge,
  HeartHandshake,
  HelpCircle,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Percent,
  PiggyBank,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientPortal } from "@/lib/client-portal-api";
import { getCurrentUser, signOut } from "@/lib/auth";
import { isAssessmentComplete } from "@/lib/assessment-progress";
import { ASSESSMENT_PATH, DASHBOARD_PATH } from "@/lib/assessment-guard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { group: "Overview", items: [{ to: DASHBOARD_PATH, label: "Dashboard", icon: LayoutGrid }] },
  {
    group: "AI Financial Statement",
    items: [
      { to: "/ai-financial-statement/income", label: "Income", icon: Wallet },
      { to: "/ai-financial-statement/expenditure", label: "Expenditure", icon: ArrowDownRight },
      { to: "/ai-financial-statement/monthly-surplus", label: "Monthly Surplus", icon: TrendingUp },
      { to: "/ai-financial-statement/disposable-income", label: "Disposable Income", icon: PiggyBank },
      { to: "/ai-financial-statement/debt-ratio", label: "Debt Ratio", icon: Percent },
      { to: "/ai-financial-statement/housing-ratio", label: "Housing Ratio", icon: Home },
      { to: "/ai-financial-statement/financial-stress-score", label: "Financial Stress Score", icon: Gauge },
    ],
  },
  {
    group: "Debt Analysis Engine",
    items: [
      { to: "/debt-analysis-engine/priority-debts", label: "Priority Debts", icon: AlertTriangle },
      { to: "/debt-analysis-engine/non-priority-debts", label: "Non-Priority Debts", icon: CreditCard },
      { to: "/debt-analysis-engine/secured-other-debts", label: "Secured Debts", icon: Shield },
      { to: "/debt-analysis-engine/debt-calculations", label: "Debt Calculations", icon: Calculator },
    ],
  },
  {
    group: "Vulnerability Assessment",
    items: [
      {
        to: "/vulnerability-module/identify-vulnerabilities",
        label: "Identify Vulnerabilities",
        icon: HeartHandshake,
      },
      { to: "/vulnerability-module/risk-assessment", label: "Risk Assessment", icon: ShieldAlert },
      {
        to: "/vulnerability-module/solicitor-review-flag",
        label: "Solicitor Review Flag",
        icon: Flag,
      },
    ],
  },
  {
    group: "Debt Solution Engine",
    items: [
      {
        to: "/debt-solution-engine/assess-suitability",
        label: "Assess Suitability",
        icon: ClipboardCheck,
      },
      { to: "/debt-solution-engine/recommendation", label: "Recommendation", icon: Sparkles },
    ],
  },
  {
    group: "Risk Engine",
    items: [
      { to: "/risk-engine/risk-identification", label: "Risk Identification", icon: FileSearch },
      { to: "/risk-engine/risk-score", label: "Risk Score", icon: Gauge },
    ],
  },
  {
    group: "Document Generator",
    items: [
      {
        to: "/document-generator/generated-documents",
        label: "Generated Documents",
        icon: FileStack,
      },
      {
        to: "/document-generator/view-download-documents",
        label: "View / Download Documents",
        icon: Download,
      },
    ],
  },
  {
    group: "AI Client Adviser",
    items: [
      { to: "/ai-client-adviser/explain-debt-options", label: "Explain Debt Options", icon: BookOpen },
      { to: "/ai-client-adviser/explain-terminology", label: "Explain Terminology", icon: CircleHelp },
      {
        to: "/ai-client-adviser/answer-common-questions",
        label: "Answer Common Questions",
        icon: HelpCircle,
      },
      {
        to: "/ai-client-adviser/check-uploaded-documents",
        label: "Check Uploaded Documents",
        icon: FileSearch,
      },
      {
        to: "/ai-client-adviser/request-missing-evidence",
        label: "Request Missing Evidence",
        icon: FileWarning,
      },
      {
        to: "/ai-client-adviser/prepare-client-for-appointments",
        label: "Prepare Client for Appointments",
        icon: CalendarCheck,
      },
      {
        to: "/ai-client-adviser/provide-status-updates",
        label: "Provide Status Updates",
        icon: Activity,
      },
    ],
  },
];

function SidebarContent({
  onNavigate,
  assessmentComplete,
}: {
  onNavigate?: () => void;
  assessmentComplete: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // During mandatory onboarding, do not expose dashboard or other portal links.
  if (!assessmentComplete) {
    return (
      <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
        <div className="px-2">
          <Logo to={ASSESSMENT_PATH} inverted />
        </div>
        <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
            Onboarding
          </p>
          <p className="mt-2 text-sm font-semibold text-sidebar-accent-foreground">
            Complete your debt assessment
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/70">
            Finish all 17 steps to unlock your Client Dashboard.
          </p>
        </div>
        <div className="mt-auto rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-sidebar-accent-foreground">
            <ShieldCheck className="size-3.5 text-sidebar-primary" /> Bank-level security
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/70">
            Your data is encrypted and only shared with your assigned solicitor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <div className="px-2">
        <Logo to={DASHBOARD_PATH} inverted />
      </div>
      <nav className="flex-1 space-y-6">
        {nav.map((section) => (
          <div key={section.group} className="space-y-1">
            <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
              {section.group}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-soft"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon
                    className={`size-4 transition-colors ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-primary"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-sidebar-accent-foreground">
          <ShieldCheck className="size-3.5 text-sidebar-primary" /> Bank-level security
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/70">
          Your data is encrypted and only shared with your assigned solicitor.
        </p>
      </div>
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [assessmentComplete, setAssessmentComplete] = useState(false);
  const [user, setUser] = useState(getCurrentUser);
  const navigate = useNavigate();
  const { data } = useClientPortal();
  const notifications = data?.portal.notifications ?? [];
  const unread = notifications.filter((n) => n.unread).length;
  const firstName = user.name.split(" ")[0] ?? user.name;

  useEffect(() => {
    const sync = () => setAssessmentComplete(isAssessmentComplete());
    const syncUser = () => setUser(getCurrentUser());
    sync();
    syncUser();
    window.addEventListener("storage", sync);
    window.addEventListener("assessment-progress-change", sync);
    window.addEventListener("auth-role-change", syncUser);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("assessment-progress-change", sync);
      window.removeEventListener("auth-role-change", syncUser);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] bg-sidebar text-sidebar-foreground lg:block">
        <SidebarContent assessmentComplete={assessmentComplete} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-primary/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-sidebar text-sidebar-foreground">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-5 rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              <X className="size-4" />
            </button>
            <SidebarContent
              assessmentComplete={assessmentComplete}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="relative hidden max-w-sm flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search cases, documents, creditors…"
                className="h-10 rounded-full border-border bg-muted/60 pl-9"
                disabled={!assessmentComplete}
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex rounded-full text-xs font-medium border-primary/30">
                {assessmentComplete ? "Customer Portal" : "Assessment in progress"}
              </Button>
              {assessmentComplete && (
                <>
                  <Button asChild variant="ghost" size="icon" className="relative" aria-label="Notifications">
                    <Link to="/messages">
                      <Bell className="size-5" />
                      {unread > 0 && (
                        <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-[0.6rem] font-bold text-destructive-foreground">
                          {unread}
                        </span>
                      )}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="hidden rounded-full sm:inline-flex">
                    <Link to="/assistant">
                      <Sparkles className="size-4" /> Ask FG AI
                    </Link>
                  </Button>
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-muted">
                    <span className="grid size-8 place-items-center rounded-full gradient-deep text-xs font-bold text-primary-foreground">
                      {user.avatar}
                    </span>
                    <span className="hidden text-sm font-medium sm:block">{firstName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block text-sm font-semibold">
                      {user.name}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {user.reference ? `Ref ${user.reference}` : user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {assessmentComplete && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/profile">
                          <UserRound className="size-4" /> Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/profile">
                          <Settings className="size-4" /> Account settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/login" });
                    }}
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] animate-rise px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
