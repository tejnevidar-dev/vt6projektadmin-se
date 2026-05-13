import { supabase } from "@/integrations/supabase/client";

export interface Saljare {
  id: string;
  display_name: string;
  email: string;
}

/** Hämtar alla användare med rollen 'saljare' eller 'admin'. */
export async function fetchSaljare(): Promise<Saljare[]> {
  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["saljare", "admin"]);
  if (rolesErr) throw rolesErr;

  const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
  if (ids.length === 0) return [];

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", ids);
  if (profErr) throw profErr;

  return (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name || p.email || "Okänd",
    email: p.email,
  }));
}
