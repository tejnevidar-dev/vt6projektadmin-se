import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Webhook, Settings, LogOut, ChevronLeft, ChevronRight, Search, Bell, ChevronRight as Caret, Shield, CalendarCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard, group: "Arbeta", adminOnly: false },
  { to: "/leads", label: "Leads", icon: Users, group: "Arbeta", adminOnly: false },
  { to: "/bokade", label: "Bokade", icon: CalendarCheck, group: "Arbeta", adminOnly: false },
  { to: "/pagaende", label: "Pågående", icon: Loader2, group: "Arbeta", adminOnly: false },
  { to: "/slutforda", label: "Slutförda", icon: CheckCircle2, group: "Arbeta", adminOnly: false },
  { to: "/admin", label: "Medlemmar", icon: Shield, group: "Hantera", adminOnly: false },
  { to: "/webhook-logs", label: "Webhook-loggar", icon: Webhook, group: "Hantera", adminOnly: true },
  { to: "/settings", label: "Inställningar", icon: Settings, group: "Hantera", adminOnly: false },
] as const;

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

interface AppShellProps extends PageHeaderProps {
  children: ReactNode;
  topbarActions?: ReactNode;
}

export function AppShell({ children, title, description, meta, actions, tabs, topbarActions }: AppShellProps) {
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRoles();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login", search: {} });
  };

  const visibleNav = navItems.filter((i) => !i.adminOnly || isAdmin);
  const groups = Array.from(new Set(visibleNav.map((i) => i.group)));
  const activeNav = visibleNav.find((i) => pathname === i.to || (i.to !== "/dashboard" && pathname.startsWith(i.to)));
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="relative flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "sticky top-0 z-20 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 shadow-[0_3px_10px_-3px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
            <span className="text-[14px] font-semibold leading-none text-primary-foreground">S</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="text-[14px] font-semibold tracking-tight">Leads</div>
              <div className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-sans">​TAK</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pt-2">
          {groups.map((group) => (
            <div key={group} className="mb-3">
              {!collapsed && (
                <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                  {group}
                </div>
              )}
              <div className="space-y-px">
                {visibleNav.filter((i) => i.group === group).map((item) => {
                  const active = item === activeNav;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-r-full bg-primary" />}
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground")} />
                      {!collapsed && <span className="truncate font-medium">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border/70 p-2">
          <div className={cn("flex items-center gap-2.5 rounded-md px-1.5 py-1.5", collapsed && "justify-center")}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold uppercase">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium" title={user?.email ?? ""}>{user?.email ?? "—"}</div>
                <button onClick={handleSignOut} className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3 w-3" /> Logga ut
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-1 flex w-full items-center justify-center rounded-md py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={collapsed ? "Expandera" : "Komprimera"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Topbar: global, app-level controls */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-6 border-b border-border bg-background/85 px-8 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2.5 text-[12.5px]">
            <span className="font-medium text-muted-foreground/80">Säljpanel</span>
            <Caret className="h-3 w-3 text-muted-foreground/30" />
            <span className="truncate font-semibold text-foreground">{activeNav?.label ?? title}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex h-8 w-72 items-center gap-2 rounded-lg border border-border bg-card/80 px-3 text-[12.5px] text-muted-foreground shadow-sm transition-colors hover:border-border focus-within:border-ring">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">Sök leads, adresser…</span>
              <kbd className="rounded border border-border bg-muted/70 px-1.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
            </div>
            {topbarActions}
            <button className="relative rounded-lg border border-border bg-card/80 p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground" title="Notiser">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="relative z-[1] flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1440px] px-10 pt-10 pb-16">
            {/* Page header */}
            <header className="mb-8">
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
                <div className="min-w-0 flex-1 space-y-3">
                  {activeNav?.group && (
                    <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                      <span className="h-px w-6 bg-primary/50" />
                      {activeNav.group}
                    </div>
                  )}
                  <h1 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground">{title}</h1>
                  {description && (
                    <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>
                  )}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1">{actions}</div>}
              </div>
              {meta && (
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 pt-4 text-[12px] text-muted-foreground">
                  {meta}
                </div>
              )}
            </header>

            {tabs && <div className="mb-8 -mx-1">{tabs}</div>}

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laddar...</p>
      </div>
    );
  }
  if (!isAuthenticated) {
    navigate({ to: "/login", search: {} });
    return null;
  }
  return <>{children}</>;
}
