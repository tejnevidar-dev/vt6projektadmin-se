import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { fetchSaljare } from "@/lib/saljare-api";
import { setLeadSeller } from "@/lib/leads-api";
import { useUserRoles } from "@/hooks/use-role";
import type { Lead } from "@/lib/types";

const NONE = "__none__";

export function SellerCard({ lead, onUpdated }: { lead: Lead; onUpdated: () => void }) {
  const { isAdmin } = useUserRoles();
  const { data: sellers = [] } = useQuery({ queryKey: ["saljare"], queryFn: fetchSaljare });
  const [saving, setSaving] = useState(false);
  const [sellerId, setSellerId] = useState<string>(lead.sellerId ?? NONE);

  const handleChange = async (next: string) => {
    setSellerId(next);
    setSaving(true);
    try {
      const name = sellers.find((s) => s.id === next)?.display_name;
      await setLeadSeller(lead.id, next === NONE ? null : next, undefined, name);
      toast.success(next === NONE ? "Säljare borttagen" : "Säljare sparad");
      onUpdated();
    } catch {
      toast.error("Kunde inte spara säljare");
      setSellerId(lead.sellerId ?? NONE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BadgePercent className="h-4 w-4 text-primary" />
          Säljare
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label className="text-xs">Tilldelad säljare</Label>
        <Select value={sellerId} onValueChange={handleChange} disabled={!isAdmin || saving}>
          <SelectTrigger>
            <SelectValue placeholder="Välj säljare" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Ingen säljare</SelectItem>
            {sellers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Provision räknas ut automatiskt i Säljdash utifrån säljarens provisionssats.
        </p>
      </CardContent>
    </Card>
  );
}
