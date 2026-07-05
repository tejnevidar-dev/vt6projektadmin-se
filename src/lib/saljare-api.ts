import { supabase } from "@/integrations/supabase/client";
import type { EmploymentType } from "./employees-api";

export interface Saljare {
  id: string;
  display_name: string;
  email: string;
  employment_type?: EmploymentType | null;
  provision_rate?: number | null;
  monthly_salary?: number | null;
}

/** Hämtar alla användare med rollen 'saljare' eller 'admin', samt lönuppgifter från employees. */
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

  const emails = (profiles ?? []).map((p) => p.email).filter(Boolean) as string[];
  let salaryByEmail: Record<string, { employment_type: EmploymentType; provision_rate: number | null; monthly_salary: number | null }> = {};
  if (emails.length > 0) {
    const { data: emps, error: empErr } = await supabase
      .from("employees")
      .select("email, employment_type, provision_rate, monthly_salary")
      .in("email", emails);
    if (!empErr && emps) {
      salaryByEmail = Object.fromEntries(
        emps.map((e: any) => [e.email?.toLowerCase(), e])
      );
    }
  }

  return (profiles ?? []).map((p) => {
    const salary = salaryByEmail[p.email?.toLowerCase() ?? ""];
    return {
      id: p.id,
      display_name: p.display_name || p.email || "Okänd",
      email: p.email,
      employment_type: salary?.employment_type ?? null,
      provision_rate: salary?.provision_rate ?? null,
      monthly_salary: salary?.monthly_salary ?? null,
    };
  });
}
