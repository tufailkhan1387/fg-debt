import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser, roleDisplayLabel, roleHomePath, setCurrentRole, signOut, type UserRole } from "@/lib/auth";
import { useSolicitorNotifications } from "@/lib/notifications-api";
import { solicitorNav, type SolicitorNavItem } from "@/lib/solicitor-nav";
import { useComplianceMe } from "@/lib/compliance-access-api";
import { useQueryClient } from "@tanstack/react-query";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { COMPLIANCE_HOME, COMPLIANCE_ONLY } from "@/lib/app-mode";
import { toast } from "sonner";

const DEDICATED_SOLICITOR_PATHS = new Set([
  "/solicitor",
  "/solicitor/",
  "/solicitor/matters",
  "/solicitor/notifications",
  "/solicitor/tasks",
  "/solicitor/documents",
  "/solicitor/audit",
]);

function solicitorLinkProps(to: string) {
  if (DEDICATED_SOLICITOR_PATHS.has(to) || to.startsWith("/solicitor/matters/")) {
    return { to: to as any };
  }
  const splat = to.replace(/^\/solicitor\/?/, "").replace(/\/+$/, "");
  return {
    to: "/solicitor/$" as const,
    params: { _splat: splat } as any,
  };
}

function SolicitorSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useComplianceMe();
  // Compliance pages the person cannot use are left out (until their access is known, only open pages show).
  const canOpen = (item: SolicitorNavItem) => {
    if (!item.access) return true;
    if (me.data?.role === "principal") return true;
    if (item.access === "principal") return false;
    const level = me.data?.permissions?.[item.access];
    return !!level && level !== "none";
  };
  const [menuSearch, setMenuSearch] = useState("");
  const term = menuSearch.trim().toLowerCase();
  const sections = solicitorNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canOpen(item) && (!term || item.label.toLowerCase().includes(term) || section.group.toLowerCase().includes(term))),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <div className="px-2 flex items-center justify-between">
        <Logo to={COMPLIANCE_ONLY ? COMPLIANCE_HOME : "/solicitor"} inverted />
      </div>

      <div className="px-2 py-1.5 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-accent-foreground">
          <ShieldCheck className="size-4 text-sidebar-primary" />
          <span>SRA Regulated Legal Portal</span>
        </div>
        <p className="mt-1 text-[0.68rem] text-sidebar-foreground/70">
          Solicitor Super Admin • SRA ID: 817529
        </p>
      </div>

      <div className="relative px-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/50" />
        <input
          type="search"
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setMenuSearch("")}
          placeholder="Search menu…"
          aria-label="Search menu"
          className="h-9 w-full rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 pl-9 pr-3 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:border-sidebar-primary focus:outline-none"
        />
      </div>

      <nav className="flex-1 space-y-6">
        {sections.length === 0 && <p className="px-3 text-xs text-sidebar-foreground/60">No menu matches "{menuSearch.trim()}".</p>}
        {sections.map((section) => (
          <div key={section.group} className="space-y-1">
            <p className="px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
              {section.group}
            </p>
            {section.items.map((item) => {
              const active =
                item.to === "/solicitor"
                  ? pathname === "/solicitor" || pathname === "/solicitor/"
                  : item.to === "/solicitor/matters"
                    ? pathname === "/solicitor/matters" ||
                      pathname === "/solicitor/matters/" ||
                      pathname.startsWith("/solicitor/matters/")
                    : pathname === item.to || pathname === `${item.to}/`;
              const linkProps = solicitorLinkProps(item.to);
              return (
                <Link
                  key={item.to}
                  {...linkProps}
                  onClick={onNavigate}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-soft"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon
                    className={`size-4 shrink-0 transition-colors ${
                      active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-primary"
                    }`}
                  />
                  <span className="leading-snug">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Debt Advisor AI engine status; hidden while only the compliance system is shown. */}
      {!COMPLIANCE_ONLY && (
      <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/30 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-sidebar-foreground/60">AI Engine Status</span>
          <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-sidebar-primary">
            <span className="size-1.5 rounded-full bg-sidebar-primary animate-pulse" /> Active v4.2
          </span>
        </div>
        <p className="text-[0.68rem] leading-relaxed text-sidebar-foreground/70">
          AI recommendation engine operating under human-in-the-loop solicitor review mandate.
        </p>
      </div>
      )}
    </div>
  );
}

export function SolicitorShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState(getCurrentUser);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Debt Advisor matter notifications, search and role switching are hidden in compliance-only mode.
  const { notifications, unreadCount } = useSolicitorNotifications(!COMPLIANCE_ONLY);
  const unreadNotifs = unreadCount;

  useEffect(() => {
    const syncUser = () => setUser(getCurrentUser());
    window.addEventListener("auth-role-change", syncUser);
    return () => window.removeEventListener("auth-role-change", syncUser);
  }, []);

  const handleRoleSwitch = (newRole: UserRole) => {
    setCurrentRole(newRole);
    toast.info(`Switched Role to ${roleDisplayLabel(newRole)}`);
    navigate({ to: roleHomePath(newRole) as any });
  };

  return (
    <div className="min-h-screen bg-background">
      {!COMPLIANCE_ONLY && <GlobalSearchModal open={searchOpen} onOpenChange={setSearchOpen} />}

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] bg-sidebar text-sidebar-foreground lg:block">
        <SolicitorSidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-primary/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-sidebar text-sidebar-foreground">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-5 rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              <X className="size-4" />
            </button>
            <SolicitorSidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[272px]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="size-5" />
              </Button>

              {/* Universal Search Trigger */}
              {!COMPLIANCE_ONLY && (
              <button
                onClick={() => setSearchOpen(true)}
                className="relative flex h-10 w-64 md:w-80 items-center gap-2 rounded-full border border-border bg-muted/60 px-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted"
              >
                <Search className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate">Search matters, clients, docs...</span>
                <kbd className="ml-auto pointer-events-none hidden rounded border border-border bg-background px-1.5 py-0.5 text-[0.65rem] font-mono font-medium sm:inline-block">
                  Cmd K
                </kbd>
              </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!COMPLIANCE_ONLY && (
              <>
              {/* Role Switcher Badge */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:inline-flex rounded-full text-xs font-medium border-primary/30">
                    Solicitor Portal
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">Select Active Demo Role</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleRoleSwitch("solicitor")} className="font-semibold text-primary">
                    <ShieldCheck className="size-4 mr-2" /> Solicitor Dashboard (Current)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRoleSwitch("client")}>
                    <UserRound className="size-4 mr-2" /> Client Portal (Amelia Hartley)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications bell */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" aria-label="Solicitor Notifications">
                    <Bell className="size-5" />
                    {unreadNotifs > 0 && (
                      <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-rose-600 text-[0.6rem] font-bold text-white">
                        {unreadNotifs}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-2">
                  <DropdownMenuLabel className="flex items-center justify-between pb-2">
                    <span className="font-semibold text-sm">Solicitor Notifications</span>
                    <Badge variant="secondary" className="text-[0.65rem]">{unreadNotifs} Unread</Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-72 overflow-y-auto space-y-1 py-1">
                    {notifications.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => navigate({ to: `/solicitor/matters/${n.matterId}` as any })}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                          n.unread ? "bg-primary/5 font-medium" : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground mb-1">
                          <span className="font-mono text-primary">{n.matterId}</span>
                          <span>{n.timestamp}</span>
                        </div>
                        <p className="font-semibold text-foreground">{n.title}</p>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      </button>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="justify-center text-xs font-semibold text-primary">
                    <Link to="/solicitor/notifications">View All Notifications</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
              )}

              {/* User Profile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 transition-colors hover:bg-muted">
                    <span className="grid size-8 place-items-center rounded-full gradient-deep text-xs font-bold text-primary-foreground">
                      {user.avatar}
                    </span>
                    <div className="hidden text-left sm:block">
                      <span className="block text-xs font-semibold leading-tight">{user.name}</span>
                      <span className="block text-[0.65rem] text-muted-foreground leading-tight">{user.title}</span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block text-sm font-semibold">{user.name}</span>
                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                    {user.sraNumber ? (
                      <span className="block text-[0.68rem] text-primary mt-0.5">SRA Reg #: {user.sraNumber.replace(/^SRA-/, "")}</span>
                    ) : null}
                  </DropdownMenuLabel>
                  {!COMPLIANCE_ONLY && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleRoleSwitch("client")}>
                        <UserRound className="size-4 mr-2" /> Switch to Client View
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      queryClient.clear();
                      navigate({ to: "/login" });
                    }}
                  >
                    <LogOut className="size-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto w-full max-w-[1500px] animate-rise px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
