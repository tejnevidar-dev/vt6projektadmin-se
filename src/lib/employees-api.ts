import { supabase } from "@/integrations/supabase/client";

export type EmploymentType = "timanstalld" | "fast" | "underentreprenor";

export interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  personal_number: string | null;
  employment_type: EmploymentType;
  hourly_rate: number | null;
  monthly_salary: number | null;
  company_name: string | null;
  org_number: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeInput = Omit<Employee, "id" | "created_at" | "updated_at">;

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("active", { ascending: false })
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function createEmployee(input: Partial<EmployeeInput> & { full_name: string }): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert(input as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .update(patch as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}
