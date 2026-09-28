// Admin/säljare-funktioner för bokningsflödet: lista, bekräfta, avboka. Bekräftelsen sätter
// leads.booking_date (så jobbets adress/kund syns i leaden som vanligt) och lägger en
// påminnelse till den TILLDELADE SÄLJAREN via det redan befintliga booking_reminders-systemet
// (send-booking-reminders-cronen, körs var 5:e minut) - ALDRIG till kunden. Ingen ny
// pårminnelsemotor behövdes.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SLOT_DEFAULT_TIME: Record<string, string> = { formiddag: "09:00", eftermiddag: "13:00" };
/** Hur långt innan besöket säljaren påminns. */
const REMINDER_OFFSET_MINUTES = 60;

export interface BookingRequestRow {
  id: string;
  lead_id: string;
  lead_name: string;
  seller_id: string | null;
  seller_name: string | null;
  slot: string;
  requested_date: string | null;
  status: string;
  confirmed_date: string | null;
  confirmed_slot: string | null;
  created_at: string;
}

export const listBookingRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BookingRequestRow[]> => {
    const { data, error } = await (context.supabase as any)
      .from("booking_requests")
      .select("id, lead_id, slot, requested_date, status, confirmed_date, confirmed_slot, created_at, leads(name, seller_id, profiles:seller_id(display_name))")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      lead_id: r.lead_id,
      lead_name: r.leads?.name ?? "",
      seller_id: r.leads?.seller_id ?? null,
      seller_name: r.leads?.profiles?.display_name ?? null,
      slot: r.slot,
      requested_date: r.requested_date,
      status: r.status,
      confirmed_date: r.confirmed_date,
      confirmed_slot: r.confirmed_slot,
      created_at: r.created_at,
    }));
  });

export interface ConfirmBookingInput {
  bookingId: string;
  /** ÅÅÅÅ-MM-DD */
  date: string;
  slot: "formiddag" | "eftermiddag";
  /** HH:MM, valfri - annars ett standardklockslag per halvdag. */
  time?: string;
}

export const confirmBookingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ConfirmBookingInput) => {
    if (!input?.bookingId || !input.date || !input.slot) throw new Error("bookingId, date och slot krävs");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: booking, error: bErr } = await sb.from("booking_requests").select("id, lead_id, status").eq("id", data.bookingId).maybeSingle();
    if (bErr || !booking) throw new Error("Bokningen hittades inte");
    if (booking.status !== "ny") throw new Error("Bokningen är redan hanterad");

    const { data: lead, error: lErr } = await sb.from("leads").select("id, name, seller_id, email, phone").eq("id", booking.lead_id).maybeSingle();
    if (lErr || !lead) throw new Error("Leaden hittades inte");

    const time = data.time?.match(/^\d{2}:\d{2}$/) ? data.time : SLOT_DEFAULT_TIME[data.slot];
    // Sparas som Stockholm-lokal tid (samma antagande som övriga admin-datumfält i CRM:et).
    const bookingDateIso = new Date(`${data.date}T${time}:00+02:00`).toISOString();

    const now = new Date().toISOString();
    const { error: updBookingErr } = await sb
      .from("booking_requests")
      .update({ status: "bekraftad", confirmed_date: data.date, confirmed_slot: data.slot, confirmed_by: context.userId, confirmed_at: now })
      .eq("id", booking.id)
      .eq("status", "ny");
    if (updBookingErr) throw new Error(updBookingErr.message);

    await sb.from("leads").update({ booking_date: bookingDateIso }).eq("id", lead.id);

    if (lead.seller_id) {
      const { data: profile } = await sb.from("profiles").select("email, display_name").eq("id", lead.seller_id).maybeSingle();
      if (profile?.email) {
        const scheduledAt = new Date(new Date(bookingDateIso).getTime() - REMINDER_OFFSET_MINUTES * 60000).toISOString();
        await sb.from("booking_reminders").insert({
          lead_id: lead.id,
          offset_minutes: REMINDER_OFFSET_MINUTES,
          channel: "email",
          recipient_type: "tilldelad",
          recipient_user_id: lead.seller_id,
          recipient_email: profile.email,
          recipient_name: profile.display_name ?? null,
          scheduled_at: scheduledAt,
        });
      }
    }

    return { ok: true };
  });

export const cancelBookingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("booking_requests")
      .update({ status: "avbokad" })
      .eq("id", data.bookingId)
      .eq("status", "ny");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
