import { Users, Flame, Phone, CheckCircle } from "lucide-react";
import type { Lead } from "@/lib/types";

interface KpiCardsProps {
  leads: Lead[];
}

export function KpiCards({ leads }: KpiCardsProps) {
  const total = leads.length;
  const hot = leads.filter((l) => l.status === "hot").length;
  const warm = leads.filter((l) => l.status === "warm").length;
  const customers = leads.filter((l) => l.status === "customer").length;

  const cards = [
    {
      label: "Totala leads",
      value: total,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Heta leads",
      value: hot,
      icon: Flame,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Varma leads",
      value: warm,
      icon: Phone,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Kunder",
      value: customers,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-card-foreground">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
