import { X, Phone, MapPin, Calendar, Home, User, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/lib/mock-data";

interface LeadDetailProps {
  lead: Lead;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  cold: "Kall",
  warm: "Varm",
  hot: "Het",
  customer: "Kund",
  lost: "Förlorad",
};

const sourceLabels: Record<string, string> = {
  field: "Fältsälj",
  telemarketing: "Telemarketing",
  scan: "Byggnadsscanning",
  referral: "Referens",
};

export function LeadDetail({ lead, onClose }: LeadDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-card-foreground">{lead.name}</h2>
            <p className="text-sm text-muted-foreground">{lead.age} år · {sourceLabels[lead.source]}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow icon={Phone} label="Telefon">
              <a href={`tel:${lead.phone.replace(/[\s-]/g, "")}`} className="text-primary hover:underline">
                {lead.phone}
              </a>
            </InfoRow>
            <InfoRow icon={User} label="Status">
              <span className="font-medium">{statusLabels[lead.status]}</span>
            </InfoRow>
          </div>

          <InfoRow icon={MapPin} label="Adress">
            <span>{lead.address}</span>
          </InfoRow>

          <div className="grid grid-cols-3 gap-4">
            <InfoRow icon={Calendar} label="Byggnadsår">
              <span className="font-medium">{lead.buildYear}</span>
            </InfoRow>
            <InfoRow icon={Home} label="Taktyp">
              <span>{lead.roofType}</span>
            </InfoRow>
            <InfoRow icon={Home} label="Takålder">
              <span className={`font-medium ${lead.roofAge > 40 ? "text-destructive" : ""}`}>
                {lead.roofAge} år
              </span>
            </InfoRow>
          </div>

          {lead.hasRoofPermit && (
            <div className="rounded-lg bg-warning/10 p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-warning-foreground" />
                <span className="text-sm font-medium text-warning-foreground">
                  Bygglov ansökt (takarbete)
                </span>
              </div>
            </div>
          )}

          {lead.notes && (
            <div className="rounded-lg bg-muted p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Anteckningar</span>
              </div>
              <p className="text-sm text-card-foreground">{lead.notes}</p>
            </div>
          )}

          {lead.lastContact && (
            <p className="text-xs text-muted-foreground">
              Senast kontaktad: {lead.lastContact}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button className="flex-1" asChild>
            <a href={`tel:${lead.phone.replace(/[\s-]/g, "")}`}>
              <Phone className="mr-2 h-4 w-4" />
              Ring
            </a>
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Stäng
          </Button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm text-card-foreground">{children}</div>
    </div>
  );
}
