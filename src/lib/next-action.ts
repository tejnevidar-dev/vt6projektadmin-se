import type { Lead } from "@/lib/types";

export interface NextActionState {
  label: string;
  /** Tailwind-klasser för badge. */
  className: string;
  overdue: boolean;
  today: boolean;
  date: Date;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Status för leadets planerade nästa åtgärd – null om ingen är satt. */
export function nextActionState(lead: Lead, now = new Date()): NextActionState | null {
  if (!lead.nextActionAt) return null;
  const date = new Date(lead.nextActionAt);
  if (Number.isNaN(date.getTime())) return null;

  const today = startOfDay(now).getTime();
  const day = startOfDay(date).getTime();
  const time = date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

  if (day < today) {
    const days = Math.round((today - day) / 86400000);
    return {
      label: `Försenad ${days} d`,
      className: "bg-destructive/15 text-destructive",
      overdue: true,
      today: false,
      date,
    };
  }
  if (day === today) {
    return {
      label: `Idag ${time}`,
      className: "bg-warning/15 text-warning-foreground",
      overdue: false,
      today: true,
      date,
    };
  }
  return {
    label: date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
    className: "bg-muted text-muted-foreground",
    overdue: false,
    today: false,
    date,
  };
}

/** Sant när åtgärden är försenad eller planerad till idag. */
export function isNextActionDue(lead: Lead, now = new Date()): boolean {
  const s = nextActionState(lead, now);
  return !!s && (s.overdue || s.today);
}
