import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Bell,
  Bot,
  CreditCard,
  FileStack,
  FileUp,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  PieChart,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customer, notifications } from "@/lib/mock-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { group: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutGrid }] },
  {
    group: "My journey",
    items: [
      { to: "/assessment", label: "Debt Assessment", icon: Gauge },
      { to: "/verification", label: "Identity Verification", icon: ShieldCheck },
      { to: "/upload-documents", label: "Upload Documents", icon: FileUp },
    ],
  },
  {
    group: "Insights",
    items: [
      { to: "/financial-summary", label: "Financial Summary", icon: PieChart },
      { to: "/debt-summary", label: "Debt Summary", icon: CreditCard },
      { to: "/recommendation", label: "AI Recommendation", icon: Sparkles },
      { to: "/assistant", label: "AI Assistant", icon: Bot },
    ],
  },
  {
    group: "Records",
    items: [
      { to: "/cases", label: "My Cases", icon: FileStack },
      { to: "/documents", label: "My Documents", icon: FileStack },
      { to: "/referrals", label: "Referrals", icon: Send },
      { to: "/messages", label: "Messages", icon: MessageSquare },
      { to: "/profile", label: "Profile", icon: UserRound },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <div className="px-2">
        <Logo to="/dashboard" inverted />
      </div>
      <nav className="flex-1 space-y-6">
        {nav.map((section) => (
          <div key={section.group} className="space-y-1">
            <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
              {section.group}
            </p>
            {section.items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-soft"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon
                    className={`size-4 transition-colors ${active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-primary"}`}
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
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] bg-sidebar text-sidebar-foreground lg:block">
        <SidebarContent />
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
            <SidebarContent onNavigate={() => setOpen(false)} />
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
              />
            </div>
            <div className="ml-auto flex items-center gap-1.5">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-muted">
                    <span className="grid size-8 place-items-center rounded-full gradient-deep text-xs font-bold text-primary-foreground">
                      {customer.initials}
                    </span>
                    <span className="hidden text-sm font-medium sm:block">{customer.firstName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block text-sm font-semibold">
                      {customer.firstName} {customer.lastName}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Ref {customer.reference}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuItem asChild>
                    <Link to="/login">
                      <LogOut className="size-4" /> Sign out
                    </Link>
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
