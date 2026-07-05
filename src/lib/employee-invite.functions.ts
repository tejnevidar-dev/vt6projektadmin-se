import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InviteRole = "admin" | "saljare" | "arbetsledare" | "hantverkare" | "underentreprenor" | "viewer";

export const sendEmployeeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; role: InviteRole; displayName?: string; redirectTo?: string }) => {
    if (!input?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new Error("Ogiltig e-postadress");
    }
    const roles: InviteRole[] = ["admin", "saljare", "arbetsledare", "hantverkare", "underentreprenor", "viewer"];
    if (!roles.includes(input.role)) throw new Error("Ogiltig roll");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Endast administratörer kan bjuda in användare");

    const email = data.email.trim().toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create invitation row so handle_new_user assigns correct role on signup
    const { data: inv, error: invErr } = await supabaseAdmin
      .from("invitations")
      .insert({ email, role: data.role, invited_by: context.userId })
      .select("id, token")
      .single();
    if (invErr) throw new Error(invErr.message);

    // Send invite email via Supabase Auth admin (works even with signup disabled)
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        invite_token: (inv as any).token,
        display_name: data.displayName ?? null,
      },
      redirectTo: data.redirectTo,
    });
    if (mailErr) {
      const msg = mailErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // Användaren finns redan i auth – radera den befintliga och skicka en ny inbjudan
        let existingUserId: string | null = null;
        try {
          for (let page = 1; page <= 10 && !existingUserId; page++) {
            const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
            if (listErr) break;
            const found = listData.users.find((u: any) => (u.email ?? "").toLowerCase() === email);
            if (found) existingUserId = found.id;
            if (listData.users.length < 200) break;
          }
        } catch {
          // ignorera – fortsätt ändå
        }

        if (existingUserId) {
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(existingUserId);
          if (delErr) {
            await supabaseAdmin.from("invitations").delete().eq("id", (inv as any).id);
            throw new Error("Kunde inte skicka ny inbjudan: " + delErr.message);
          }
        }

        const { error: retryErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: {
            invite_token: (inv as any).token,
            display_name: data.displayName ?? null,
          },
          redirectTo: data.redirectTo,
        });
        if (retryErr) {
          await supabaseAdmin.from("invitations").delete().eq("id", (inv as any).id);
          throw new Error(retryErr.message);
        }
        return { ok: true, alreadyRegistered: true };
      }
      throw new Error(mailErr.message);
    }

    return { ok: true, alreadyRegistered: false };
  });
