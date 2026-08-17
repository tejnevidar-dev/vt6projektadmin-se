import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BadgePercent, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchSaljare } from "@/lib/saljare-api";
import { setLeadSeller } from "@/lib/leads-api";
import { commissionFor, commissionRateFor, kr, netValue } from "@/lib/commission";
import { useUserRoles } from "@/hooks/use-role";
import type { Lead } from "@/lib/types";

const NONE = "__none__";

export function SellerCard({ lead, onUpdated }: { lead: Lead; onUpdated: () => void }) {
  const { isAdmin } = useUserRoles();
  const { data: sellers = [] } = useQuery({ queryKey: ["saljare"], queryFn: fetchSaljare });
  const [saving, setSaving] = useState(false);
  const [sellerId, setSellerId] = useState<string>(lead.sellerId ?? NONE);
  const [rate, setRate] = useState<string>(lead.commissionRate != null ? String(lead.commissionRate) : "");

  const seller = sellers.find((s) => s.id === (sellerId === NONE ? lead.sellerId : sellerId)) ?? null;
  const previewLead: Lead = {
    ...lead,
    commissionRate: rate.trim() ? Number(rate.replace(",", ".")) : null,
  };
  const dirty = (lead.sellerId ?? NONE) !== sellerId || (lead.commissionRate != null ? String(lead.commissionRate) : "") !== rate;

  const save = async () => {
    setSaving(true);
    try {
      const parsed = rate.trim() ? Number(rate.replace(",", ".")) : null;
      await setLeadSeller(
        lead.id,
        sellerId === NONE ? null : sellerId,
        Number.isFinite(parsed as number) ? parsed : null,
        seller?.display_name,
      );
      toast.success("Säljare sparad");
      onUpdated();
    } catch {
      toast.error("Kunde inte spara säljare");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BadgePercent className="h-4 w-4 text-primary" />
          Säljare & provision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Säljare</Label>
            <Select value={sellerId} onValueChange={setSellerId} disabled={!isAdmin}>
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Provisionssats (%) – lämna tomt för säljarens standard</Label>
            <Input
              inputMode="decimal"
              placeholder={seller?.provision_rate != null ? String(seller.provision_rate) : "0"}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ordervärde exkl. moms</span>
            <span className="font-medium">{kr(netValue(lead))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sats</span>
            <span className="font-medium">{commissionRateFor(previewLead, seller)} %</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1">
            <span className="font-medium">Provision</span>
            <span className="font-bold text-primary">{kr(commissionFor(previewLead, seller))}</span>
          </div>
        </div>

        {isAdmin && (
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Spara
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
