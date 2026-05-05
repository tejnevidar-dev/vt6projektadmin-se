import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Webhook, Settings, LogOut, ChevronLeft, ChevronRight, ChevronRight as Caret } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Översikt", icon: LayoutDashboard, group: "Arbeta" },
  { to: "/leads", label: "Leads", icon: Users, group: "Arbeta" },
  { to: "/webhook-logs", label: "Webhook-loggar", icon: Webhook, group: "System" },
  { to: "/settings", label: "Inställningar", icon: Settings, group: "System" },
] as const;

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const groups = Array.from(new Set(navItems.map((i) => i.group)));
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="relative flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "sticky top-0 z-20 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-[64px]" : "w-[244px]"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-[0_4px_14px_-4px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
            <span className="font-display text-base italic text-primary-foreground">S</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="font-display text-[17px] italic tracking-tight">Sälj&nbsp;tak</div>
              <div className="truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Säljpanel</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {groups.map((group) => (
            <div key={group} className="mb-4">
              {!collapsed && (
                <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group}
                </div>
              )}
              <div className="space-y-0.5">
                {navItems.filter((i) => i.group === group).map((item) => {
                  const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn("h-[16px] w-[16px] shrink-0", active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")} />
                      {!collapsed && <span className="truncate font-medium">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className={cn("flex items-center gap-3 rounded-md px-2 py-2", collapsed && "justify-center")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold uppercase">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium" title={user?.email ?? ""}>{user?.email ?? "—"}</div>
                <button onClick={handleSignOut} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3 w-3" /> Logga ut
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-1 flex w-full items-center justify-center rounded-md py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={collapsed ? "Expandera" : "Komprimera"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-background/70 px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sälj&nbsp;tak</span>
            <Caret className="h-3.5 w-3.5 text-muted-foreground/50" />
            <h1 className="font-display text-[22px] italic leading-none tracking-tight text-foreground">{title}</h1>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="relative z-[1] flex-1 overflow-auto px-8 py-8">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
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
    navigate({ to: "/login" });
    return null;
  }
  return <>{children}</>;
}
