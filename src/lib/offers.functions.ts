import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeCalc, formatSek, type CalcInput, type PriceRow, type PlatItem, type TillaggRow } from "./calc-engine";

interface GenerateOfferInput {
  leadId: string;
}

const STANDARD_VILLKOR = [
  "Denna offert är giltig i 30 dagar från utfärdandedatum.",
  "Betalning: 30 % vid beställning, 70 % efter slutfört arbete. Betalvillkor 10 dagar.",
  "Angivet pris förutsätter fri arbetsyta, tillgång till el och vatten samt att befintlig konstruktion är hållbar.",
  "Eventuellt tillkommande arbete (rötskadad läkt, byte av bärläkt, etc.) offereras separat.",
  "ROT-avdraget är beräknat enligt Skatteverkets regler. Kunden ansvarar för att villkoren för ROT uppfylls.",
  "Garanti: 10 år på material enligt tillverkarens villkor, 5 år på utfört arbete.",
  "Vi förbehåller oss rätten att justera priset vid väsentligt förändrade materialkostnader (>10 %).",
];

export const generateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateOfferInput) => {
    if (!input?.leadId) throw new Error("leadId saknas");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ offerId: string; version: number; pdfPath: string; signedUrl: string }> => {
    const { supabase, userId } = context;

    // 1. Läs lead + property
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*, property:properties(*), created_by")
      .eq("id", data.leadId)
      .single();
    if (leadErr || !lead) throw new Error("Lead hittades inte");

    // 2. Läs kalkyl
    const { data: calcRaw, error: calcErr } = await supabase
      .from("calculations")
      .select("*")
      .eq("lead_id", data.leadId)
      .maybeSingle();
    if (calcErr) throw new Error(calcErr.message);
    if (!calcRaw) throw new Error("Ingen kalkyl finns – spara kalkylen först.");

    // 3. Läs prislista (för att rendera radlabels)
    const { data: priceRows, error: priceErr } = await supabase
      .from("price_list")
      .select("*");
    if (priceErr) throw new Error(priceErr.message);

    // 4. Läs säljarens uppgifter från leadens created_by
    let saljareName = "";
    let saljareEmail = "";
    let saljarePhone = "";
    const createdBy = (lead as { created_by?: string | null }).created_by;
    if (createdBy) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", createdBy)
        .maybeSingle();
      if (prof) {
        saljareName = (prof as { display_name?: string | null }).display_name ?? "";
        saljareEmail = (prof as { email?: string | null }).email ?? "";
      }
      if (saljareEmail) {
        const { data: emp } = await supabase
          .from("employees")
          .select("phone")
          .eq("email", saljareEmail)
          .maybeSingle();
        if (emp) saljarePhone = (emp as { phone?: string | null }).phone ?? "";
      }
    }

    // 5. Räkna om från input (aldrig lita på cachade totals)
    const calcInput: CalcInput = {
      roofAreaKvm: Number(calcRaw.roof_area_kvm ?? 0),
      materialKey: (calcRaw.material_key as string | null) ?? null,
      ranndalarMeter: Number(calcRaw.ranndalar_meter ?? 0),
      platItems: (calcRaw.plat_items as unknown as PlatItem[]) ?? [],
      tillagg: (calcRaw.tillagg as unknown as TillaggRow[]) ?? [],
      arbeteTimmar: Number(calcRaw.arbete_timmar ?? 0),
      arbeteTimpris: Number(calcRaw.arbete_timpris ?? 0),
      marginalProcent: Number(calcRaw.marginal_procent ?? 0),
      rotAvdrag: Boolean(calcRaw.rot_avdrag),
    };
    const result = computeCalc(calcInput, (priceRows ?? []) as unknown as PriceRow[]);

    // 6. Nästa version
    const { data: lastOffer } = await supabase
      .from("offers")
      .select("version")
      .eq("lead_id", data.leadId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((lastOffer as { version?: number } | null)?.version ?? 0) + 1;

    // 7. Bygg PDF
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595.28, 841.89]); // A4
    const width = page.getWidth();
    const height = page.getHeight();
    const marginX = 50;
    let y = height - 50;
    const primary = rgb(0.11, 0.31, 0.59);
    const text = rgb(0.12, 0.12, 0.12);
    const muted = rgb(0.4, 0.4, 0.4);
    const rule = rgb(0.85, 0.85, 0.85);

    const drawText = (t: string, x: number, yy: number, size = 10, useBold = false, color = text) => {
      page.drawText(t, { x, y: yy, size, font: useBold ? bold : font, color });
    };
    const drawLine = (yy: number) => {
      page.drawLine({ start: { x: marginX, y: yy }, end: { x: width - marginX, y: yy }, thickness: 0.5, color: rule });
    };
    const ensureSpace = (needed: number) => {
      if (y - needed < 60) {
        page = pdf.addPage([595.28, 841.89]);
        y = height - 50;
      }
    };

    // Header
    drawText("VT6 PROJEKTADMIN", marginX, y, 16, true, primary);
    drawText(`Offert #${nextVersion}`, width - marginX - 100, y, 12, true, text);
    y -= 18;
    const dateStr = new Date().toLocaleDateString("sv-SE");
    drawText("Takentreprenad", marginX, y, 9, false, muted);
    drawText(`Datum: ${dateStr}`, width - marginX - 100, y, 9, false, muted);
    y -= 20;
    drawLine(y);
    y -= 20;

    // Kund + säljare i två kolumner
    const colWidth = (width - marginX * 2 - 20) / 2;
    const leftX = marginX;
    const rightX = marginX + colWidth + 20;
    const yTopCols = y;

    drawText("KUND", leftX, y, 9, true, muted);
    let yLeft = y - 14;
    drawText(lead.name ?? "—", leftX, yLeft, 11, true); yLeft -= 14;
    const prop = lead.property as { address?: string; municipality?: string } | null;
    if (prop?.address) { drawText(prop.address, leftX, yLeft, 10); yLeft -= 13; }
    if (prop?.municipality) { drawText(prop.municipality, leftX, yLeft, 10); yLeft -= 13; }
    if (lead.phone) { drawText(`Tel: ${lead.phone}`, leftX, yLeft, 10); yLeft -= 13; }

    drawText("ANSVARIG SÄLJARE", rightX, yTopCols, 9, true, muted);
    let yRight = yTopCols - 14;
    if (saljareName) { drawText(saljareName, rightX, yRight, 11, true); yRight -= 14; }
    if (saljarePhone) { drawText(`Tel: ${saljarePhone}`, rightX, yRight, 10); yRight -= 13; }
    if (saljareEmail) { drawText(saljareEmail, rightX, yRight, 10); yRight -= 13; }

    y = Math.min(yLeft, yRight) - 10;
    drawLine(y);
    y -= 20;

    // Radtabell header
    drawText("SPECIFIKATION", marginX, y, 9, true, muted);
    y -= 16;
    const colDesc = marginX;
    const colQty = marginX + 260;
    const colUnit = marginX + 320;
    const colPrice = marginX + 380;
    const colSum = width - marginX - 50;
    drawText("Beskrivning", colDesc, y, 9, true, muted);
    drawText("Antal", colQty, y, 9, true, muted);
    drawText("Enhet", colUnit, y, 9, true, muted);
    drawText("À-pris", colPrice, y, 9, true, muted);
    drawText("Summa", colSum, y, 9, true, muted);
    y -= 8;
    drawLine(y);
    y -= 14;

    for (const line of result.lines) {
      ensureSpace(20);
      drawText(line.label, colDesc, y, 10);
      drawText(String(line.quantity), colQty, y, 10);
      drawText(String(line.unit), colUnit, y, 10);
      drawText(formatSek(line.unitPrice), colPrice, y, 10);
      drawText(formatSek(line.amount), colSum, y, 10);
      y -= 14;
    }

    y -= 6;
    drawLine(y);
    y -= 18;

    // Totaler (höger)
    ensureSpace(120);
    const labelX = width - marginX - 200;
    const valueX = width - marginX - 60;
    const totalRow = (label: string, value: string, size = 10, useBold = false, color = text) => {
      drawText(label, labelX, y, size, useBold, color);
      drawText(value, valueX, y, size, useBold, color);
      y -= size + 4;
    };
    if (result.marginalAmount > 0) {
      totalRow("Delsumma", formatSek(result.subtotalPreMargin));
      totalRow(`Marginal (${calcInput.marginalProcent}%)`, formatSek(result.marginalAmount));
    }
    totalRow("Summa exkl. moms", formatSek(result.subtotal));
    totalRow("Moms (25 %)", formatSek(result.moms));
    y -= 4;
    drawLine(y);
    y -= 14;
    totalRow("TOTALT INKL. MOMS", formatSek(result.total), 12, true, primary);
    if (result.rotBelopp > 0) {
      y -= 4;
      totalRow("ROT-avdrag (30 % av arbete)", `– ${formatSek(result.rotBelopp)}`, 10, false, muted);
      y -= 2;
      drawLine(y);
      y -= 14;
      totalRow("ATT BETALA EFTER ROT", formatSek(result.attBetala), 13, true, primary);
    }
    y -= 20;

    // Villkor
    ensureSpace(30);
    drawText("VILLKOR", marginX, y, 9, true, muted);
    y -= 14;
    for (const v of STANDARD_VILLKOR) {
      ensureSpace(18);
      // enkel word-wrap på ~90 tecken
      const words = v.split(" ");
      let line = "• ";
      for (const w of words) {
        if ((line + w).length > 95) {
          drawText(line.trim(), marginX, y, 9, false, text);
          y -= 12;
          line = "  ";
          ensureSpace(14);
        }
        line += w + " ";
      }
      if (line.trim()) {
        drawText(line.trimEnd(), marginX, y, 9, false, text);
        y -= 14;
      }
    }

    // Signatur
    ensureSpace(80);
    y -= 20;
    drawLine(y);
    y -= 24;
    drawText("ACCEPT AV OFFERT", marginX, y, 9, true, muted);
    y -= 30;
    page.drawLine({ start: { x: marginX, y }, end: { x: marginX + 220, y }, thickness: 0.5, color: text });
    page.drawLine({ start: { x: width - marginX - 220, y }, end: { x: width - marginX, y }, thickness: 0.5, color: text });
    drawText("Underskrift kund", marginX, y - 12, 8, false, muted);
    drawText("Datum & ort", width - marginX - 220, y - 12, 8, false, muted);

    const pdfBytes = await pdf.save();

    // 8. Ladda upp till storage (använd admin för RLS-oberoende skrivning)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pdfPath = `${data.leadId}/offert-v${nextVersion}-${Date.now()}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("offers")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error("Kunde inte spara PDF: " + upErr.message);

    // 9. Skapa offer-rad
    const { data: offerRow, error: offErr } = await supabase
      .from("offers")
      .insert({
        lead_id: data.leadId,
        calculation_id: (calcRaw as { id: string }).id,
        version: nextVersion,
        pdf_path: pdfPath,
        status: "draft",
        total_amount: result.attBetala,
        created_by: userId,
      })
      .select("id, version, pdf_path")
      .single();
    if (offErr) throw new Error(offErr.message);

    // 10. Uppdatera leadens senaste offer_pdf_path så OfferPdfCard visar den
    await supabaseAdmin.from("leads").update({ offer_pdf_path: pdfPath }).eq("id", data.leadId);

    // 11. Skapa signed URL
    const { data: signed } = await supabaseAdmin.storage
      .from("offers")
      .createSignedUrl(pdfPath, 60 * 30);

    return {
      offerId: (offerRow as { id: string }).id,
      version: nextVersion,
      pdfPath,
      signedUrl: signed?.signedUrl ?? "",
    };
  });
