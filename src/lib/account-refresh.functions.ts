import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only: "förnya" ett användarkonto när systemet buggar för dem.
 * - Loggar ut alla aktiva sessioner globalt (rensar gammalt state/tokens)
 * - Skickar ett återställningsmail som landar på /uppdatera-konto,
 *   där mottagaren fyller i namn/telefon/nytt lösenord.
 */
export const refreshEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; redirectTo?: string }) => {
    if (!input?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new Error("Ogiltig e-postadress");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (roleRows ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Endast administratörer kan förnya konton");

    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Hitta användaren
    let targetUserId: string | null = null;
    try {
      const { data: byEmail } = await (supabaseAdmin.auth.admin as any).getUserByEmail?.(email);
      targetUserId = byEmail?.user?.id ?? null;
    } catch {
      /* fall through */
    }
    if (!targetUserId) {
      // Fallback: paginera listUsers tills vi hittar mailen
      for (let page = 1; page <= 20 && !targetUserId; page++) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(error.message);
        const hit = list.users.find((u) => u.email?.toLowerCase() === email);
        if (hit) targetUserId = hit.id;
        if (list.users.length < 200) break;
      }
    }

    if (!targetUserId) {
      throw new Error(
        `Hittade inget konto med e-postadressen ${email}. Bjud in personen i stället.`,
      );
    }

    let signedOut = false;
    try {
      await supabaseAdmin.auth.admin.signOut(targetUserId, "global");
      signedOut = true;
    } catch {
      /* signOut kan saknas i vissa versioner – inte kritiskt */
    }

    // Återställningsmailet måste skickas med den publika nyckeln – service
    // role-klienten går inte genom Auth:s vanliga mailflöde.
    const { createClient } = await import("@supabase/supabase-js");
    const publicClient = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { error: mailErr } = await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (mailErr) throw new Error(mailErr.message);

    return { ok: true, foundUser: true, signedOut };
  });

/**
 * Uppdaterar det inloggade kontots profil, telefonnummer och lösenord
 * i ett svep. Används av "/uppdatera-konto"-flödet efter att en användare
 * följt en förnyelselänk.
 */
export const applyAccountRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    displayName?: string;
    phone?: string;
    password: string;
  }) => {
    if (!input?.password || input.password.length < 8) {
      throw new Error("Lösenordet måste vara minst 8 tecken");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const displayName = data.displayName?.trim() || null;
    const phone = data.phone?.trim() || null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Sätt nytt lösenord via admin (fungerar även om recovery-sessionen
    // har raderats på klienten, så länge middleware kunde verifiera bearer).
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (pwErr) throw new Error(pwErr.message);

    if (displayName) {
      await supabaseAdmin
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", context.userId);
    }

    // Uppdatera employee-raden kopplad till samma e-post
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRow?.user?.email?.toLowerCase();
    if (email) {
      const patch: { phone?: string | null; full_name?: string } = {};
      if (phone !== null) patch.phone = phone;
      if (displayName) patch.full_name = displayName;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("employees").update(patch).eq("email", email);
      }
    }

    return { ok: true };
  });
