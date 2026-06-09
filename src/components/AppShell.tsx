import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Webhook, Settings, LogOut, ChevronLeft, ChevronRight, Search, Bell, ChevronRight as Caret, Shield, CalendarCheck, Loader2, CheckCircle2, ClipboardList, HardHat, Briefcase, ChevronDown, Check, Hammer, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, type Side } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavChild = { to: string; label: string };

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
  side: Side | "both";
  adminOnly?: boolean;
  children?: NavChild[];
};

function buildNavItems(isAdmin: boolean): NavItem[] {
  return [
    // Extern (sälj)
    { to: "/dashboard", label: "Översikt", icon: LayoutDashboard, group: "Arbeta", side: "extern" },
    { to: "/leads", label: "Leads", icon: Users, group: "Arbeta", side: "extern" },
    { to: "/offerterade", label: "Offerterade", icon: ClipboardList, group: "Arbeta", side: "extern" },
    { to: "/bokade", label: "Bokade", icon: CalendarCheck, group: "Arbeta", side: "extern" },
    { to: "/pagaende", label: "Pågående", icon: Loader2, group: "Arbeta", side: "extern" },
    { to: "/slutforda", label: "Slutförda", icon: CheckCircle2, group: "Arbeta", side: "extern" },

    // Intern (personal)
    { to: "/jobb", label: "Projekt", icon: Hammer, group: "Arbeta", side: "intern" },
    {
      to: "/egenkontroller",
      label: "Egenkontroller",
      icon: ClipboardList,
      group: "Arbeta",
      side: "intern",
      children: [
        { to: "/egenkontroller", label: isAdmin ? "Granska egenkontroller" : "Komplettera egenkontroller" },
        ...(isAdmin ? [{ to: "/egenkontroller/instruktioner", label: "Montageinstruktioner" }] : []),
      ],
    },
    { to: "/personal", label: "Personal", icon: HardHat, group: "Hantera", side: "intern", adminOnly: true },

    // Gemensamt (Hantera)
    { to: "/admin", label: "Medlemmar", icon: Shield, group: "Hantera", side: "both" },
    { to: "/webhook-logs", label: "Webhook-loggar", icon: Webhook, group: "Hantera", side: "extern", adminOnly: true },
    { to: "/settings", label: "Inställningar", icon: Settings, group: "Hantera", side: "both" },
  ];
}

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
  const { side, setSide, canSwitch } = useWorkspace();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Stäng mobilmenyn vid navigering
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login", search: {} });
  };

  const navItems = buildNavItems(isAdmin);
  const visibleNav = navItems.filter((i) => {
    if (i.adminOnly && !isAdmin) return false;
    return i.side === "both" || i.side === side;
  });
  const groups = Array.from(new Set(visibleNav.map((i) => i.group)));
  const activeNav = visibleNav.find((i) => pathname === i.to || (i.to !== "/dashboard" && pathname.startsWith(i.to)));
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const sideLabel = side === "intern" ? "Intern" : "Extern";
  const SideIcon = side === "intern" ? HardHat : Briefcase;

  const handleSwitchSide = (next: Side) => {
    if (next === side) return;
    setSide(next);
    // Skicka användaren till en vettig startsida på den nya sidan
    navigate({ to: next === "intern" ? "/personal" : "/dashboard" });
  };

  return (
    <div className="relative flex min-h-screen w-full bg-background text-foreground">
      {/* Mobil-overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[60px]" : "lg:w-[220px]"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-2 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
          title="Stäng meny"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-14 items-center px-2">
          {canSwitch ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent/60",
                    collapsed && "justify-center"
                  )}
                  title={collapsed ? `admin.vt6 · ${sideLabel}` : undefined}
                >
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 shadow-[0_3px_10px_-3px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
                    <span className="text-[14px] font-semibold leading-none text-primary-foreground">a</span>
                  </div>
                  {!collapsed && (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-1 leading-tight">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold tracking-tight">admin.vt6</div>
                        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                          <SideIcon className="h-2.5 w-2.5" />
                          {sideLabel}
                        </div>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Växla arbetsyta
                </DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={side === "extern"}
                  onClick={() => handleSwitchSide("extern")}
                  className="gap-2.5 py-2"
                >
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Extern</div>
                  </div>
                  {side === "extern" && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={side === "intern"}
                  onClick={() => handleSwitchSide("intern")}
                  className="gap-2.5 py-2"
                >
                  <HardHat className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Intern</div>
                  </div>
                  {side === "intern" && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5",
                collapsed && "justify-center"
              )}
              title={collapsed ? `admin.vt6 · ${sideLabel}` : undefined}
            >
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 shadow-[0_3px_10px_-3px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
                <span className="text-[14px] font-semibold leading-none text-primary-foreground">a</span>
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[14px] font-semibold tracking-tight">admin.vt6</div>
                  <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                    <SideIcon className="h-2.5 w-2.5" />
                    {sideLabel}
                  </div>
                </div>
              )}
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
                  const showChildren = !collapsed && item.children && active;
                  return (
                    <div key={item.to}>
                      <Link
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
                      {showChildren && (
                        <div className="ml-6 mt-0.5 space-y-px border-l border-sidebar-border/60 pl-2">
                          {item.children!.map((child) => {
                            const childActive =
                              pathname === child.to ||
                              (child.to !== item.to && pathname.startsWith(child.to + "/"));
                            // For the index child (same path as parent), only "active" when exactly equal
                            const isIndexChild = child.to === item.to;
                            const isActive = isIndexChild ? pathname === child.to : childActive;
                            return (
                              <Link
                                key={child.to}
                                to={child.to}
                                className={cn(
                                  "block rounded-md px-2 py-1 text-[12.5px] transition-colors",
                                  isActive
                                    ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium"
                                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
            className="mt-1 hidden w-full items-center justify-center rounded-md py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
            title={collapsed ? "Expandera" : "Komprimera"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Topbar: global, app-level controls */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-4 lg:gap-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 text-[12.5px]">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-border bg-card/80 p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:hidden"
              title="Öppna meny"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="hidden font-medium text-muted-foreground/80 sm:inline">admin.vt6</span>
            <Caret className="hidden h-3 w-3 text-muted-foreground/30 sm:block" />
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
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-12 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10 lg:pb-16">
            {/* Page header */}
            <header className="mb-6 lg:mb-8">
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 lg:gap-y-5">
                <div className="min-w-0 flex-1 space-y-2 lg:space-y-3">
                  {activeNav?.group && (
                    <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                      <span className="h-px w-6 bg-primary/50" />
                      {activeNav.group}
                    </div>
                  )}
                  <h1 className="text-[26px] font-semibold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[30px] lg:text-[36px]">{title}</h1>
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

            {tabs && <div className="mb-6 -mx-1 overflow-x-auto lg:mb-8">{tabs}</div>}

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
