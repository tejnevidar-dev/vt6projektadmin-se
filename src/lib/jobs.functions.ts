import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HOURLY_RATE = 600;

function isAdminOrSeller(roleRows: { role: string }[] | null | undefined): boolean {
  return (roleRows ?? []).some((r: any) => r.role === "admin" || r.role === "saljare");
}

function stripSensitive(job: any, adminOrSeller: boolean): any {
  if (adminOrSeller) return job;
  const {
    fixed_price,
    estimated_hours,
    hide_time_estimate,
    client_company,
    client_contact_name,
    client_email,
    customer_phone,
    notes,
    self_checks_emailed_at,
    self_checks_emailed_to,
    ...safe
  } = job;

  // Strip lead.price
  if (safe.lead) {
    const { price, ...safeLead } = safe.lead;
    safe.lead = safeLead;
  }

  // Compute estimated hours so non-admins can still see hour budget unless hidden
  const rawPrice = fixed_price ?? job.lead?.price ?? null;
  const computedHours = rawPrice != null ? rawPrice / HOURLY_RATE : null;
  const visibleHours = hide_time_estimate ? null : (estimated_hours ?? computedHours);

  return { ...safe, estimated_hours: visibleHours };
}

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const canSeeSensitive = isAdminOrSeller(roleRows);

    const { data: job, error } = await supabase
      .from("jobs")
      .select("*, lead:leads(id, name, phone, job_type, property_id, price)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!job) return null;

    let property = null;
    if (job.lead?.property_id) {
      const { data: p } = await supabase
        .from("properties")
        .select("address, municipality")
        .eq("id", job.lead.property_id)
        .maybeSingle();
      property = p ?? null;
    }

    return stripSensitive({ ...job, property }, canSeeSensitive);
  });

export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const canSeeSensitive = isAdminOrSeller(roleRows);

    const { data, error } = await supabase
      .from("jobs")
      .select("*, lead:leads(id, name, phone, job_type, property_id, price)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as any[];
    const propIds = Array.from(
      new Set(rows.map((r) => r.lead?.property_id).filter(Boolean) as string[])
    );
    let propMap: Record<string, { address: string; municipality: string }> = {};
    if (propIds.length) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, address, municipality")
        .in("id", propIds);
      propMap = Object.fromEntries(
        (props ?? []).map((p: any) => [p.id, { address: p.address, municipality: p.municipality }])
      );
    }

    const jobs = rows.map((r) => ({
      ...r,
      property: r.lead?.property_id ? propMap[r.lead.property_id] ?? null : null,
    }));

    return jobs.map((j) => stripSensitive(j, canSeeSensitive));
  });
