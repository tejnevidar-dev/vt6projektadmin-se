import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole =
  | "admin"
  | "saljare"
  | "viewer"
  | "arbetsledare"
  | "hantverkare"
  | "underentreprenor"
  | "ekonomi";

export type Side = "intern" | "extern";

const EXTERNAL_ROLES: AppRole[] = ["saljare"];
const INTERNAL_ROLES: AppRole[] = ["arbetsledare", "hantverkare", "underentreprenor"];

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setRoles((data ?? []).map((r: any) => r.role as AppRole));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isAdmin = roles.includes("admin");
  const isEkonomi = roles.includes("ekonomi") || isAdmin;
  const isSaljare = roles.includes("saljare") || isAdmin;
  const isInternal = isAdmin || roles.some((r) => INTERNAL_ROLES.includes(r));
  const isExternal = isAdmin || roles.some((r) => EXTERNAL_ROLES.includes(r));

  return {
    roles,
    loading,
    isAdmin,
    isEkonomi,
    isSaljare,
    isInternal,
    isExternal,
    canEdit: isAdmin || roles.includes("saljare"),
  };
}

/** Check whether a set of roles allows access to the given side (intern/extern). */
export function rolesAllowSide(roles: AppRole[], side: Side): boolean {
  if (roles.includes("admin")) return true;
  if (side === "intern") return roles.some((r) => INTERNAL_ROLES.includes(r));
  return roles.some((r) => EXTERNAL_ROLES.includes(r));
}
