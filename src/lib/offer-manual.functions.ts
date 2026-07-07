import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface OfferRow {
  radnr: number;
  beskrivning: string;
}

export interface OfferVillkorSektion {
  rubrik: string;
  brodtext: string;
}

export interface OfferInput {
  offertnr: string;
  offertdatum: string; // YYYY-MM-DD
  giltigTom: string; // YYYY-MM-DD
  betalningsvillkor: string;

  kundNamn: string;
  objektadress: string;
  telefon: string;
  mail: string;
  fastighetsbeteckning: string;

  intro: string;

  rader: OfferRow[];

  entreprenadprisExklMoms: number;
  materialkostnad: number;
  momsProcent: number; // default 25
  rotBelopp: number;
  rotEtikett: string; // ex "(2 ägare)" eller ""

  noteringar: string[];
  villkor: OfferVillkorSektion[];

  filnamn?: string;
}

const COMPANY_NAME = "ROSLAGSTAK";
const COMPANY_TAGLINE = "Offerten avser takentreprenad enligt följande.";
const FOOTER_TEXT =
  "RoslagsTak (VT6 Invest AB)   ·   Org.nr 559539-3595   ·   Momsnr SE559539359501   ·   Godkänd för F-skatt";

function fmtSek(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${abs} kr`;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  return iso;
}

export const generateManualOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OfferInput) => {
    if (!input?.offertnr) throw new Error("Offertnr saknas");
    if (!input.kundNamn) throw new Error("Kundnamn saknas");
    if (!Array.isArray(input.rader) || input.rader.length === 0)
      throw new Error("Minst en rad krävs");
    return input;
  })
  .handler(async ({ data }): Promise<{ filename: string; base64: string }> => {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

    const A4: [number, number] = [595.28, 841.89];
    const marginX = 50;
    const marginTop = 55;
    const marginBottom = 70;

    // Färger – seriös, mörk palett
    const INK = rgb(0, 0, 0);
    const BODY = rgb(0.15, 0.15, 0.15);
    const MUTED = rgb(0.4, 0.4, 0.4);
    const RULE = rgb(0.75, 0.75, 0.75);
    const SOFT = rgb(0.95, 0.95, 0.95);
    const ACCENT = rgb(0, 0, 0);
    const ACCENT_DARK = rgb(0, 0, 0);
    const WHITE = rgb(1, 1, 1);

    const pages: any[] = [];
    let page = pdf.addPage(A4);
    pages.push(page);
    let width = page.getWidth();
    let height = page.getHeight();
    let y = height - marginTop;

    const setPage = (p: any) => {
      page = p;
      width = page.getWidth();
      height = page.getHeight();
    };

    const draw = (
      text: string,
      x: number,
      yy: number,
      size = 10,
      useBold = false,
      color = BODY,
    ) => {
      page.drawText(sanitize(text), {
        x,
        y: yy,
        size,
        font: useBold ? bold : font,
        color,
      });
    };

    const drawItalic = (text: string, x: number, yy: number, size = 10, color = MUTED) => {
      page.drawText(sanitize(text), { x, y: yy, size, font: oblique, color });
    };

    const textWidth = (text: string, size: number, useBold = false) => {
      const f = useBold ? bold : font;
      return f.widthOfTextAtSize(sanitize(text), size);
    };

    const drawRight = (
      text: string,
      xRight: number,
      yy: number,
      size = 10,
      useBold = false,
      color = BODY,
    ) => {
      const w = textWidth(text, size, useBold);
      page.drawText(sanitize(text), {
        x: xRight - w,
        y: yy,
        size,
        font: useBold ? bold : font,
        color,
      });
    };

    const drawCenter = (
      text: string,
      cx: number,
      yy: number,
      size = 10,
      useBold = false,
      color = BODY,
    ) => {
      const w = textWidth(text, size, useBold);
      page.drawText(sanitize(text), {
        x: cx - w / 2,
        y: yy,
        size,
        font: useBold ? bold : font,
        color,
      });
    };

    const hr = (yy: number, color = RULE, thickness = 0.6, x1 = marginX, x2?: number) => {
      page.drawLine({
        start: { x: x1, y: yy },
        end: { x: (x2 ?? width - marginX), y: yy },
        thickness,
        color,
      });
    };

    const rect = (
      x: number,
      yy: number,
      w: number,
      h: number,
      fill?: any,
      stroke?: any,
      strokeWidth = 0.6,
    ) => {
      page.drawRectangle({
        x,
        y: yy,
        width: w,
        height: h,
        color: fill,
        borderColor: stroke,
        borderWidth: stroke ? strokeWidth : 0,
      });
    };

    const drawHeader = () => {
      // Övre accentband
      rect(0, height - 3, width, 3, INK);
      // Namn centrerat
      drawCenter(COMPANY_NAME, width / 2, height - 44, 26, true, INK);
      // Tagline med accent under
      drawCenter(COMPANY_TAGLINE, width / 2, height - 60, 8, true, ACCENT_DARK);
      // Tunn linje under header
      hr(height - 74, RULE, 0.5);
    };

    const drawFooter = (pageIdx: number, totalPages: number) => {
      const fy = 40;
      page.drawLine({
        start: { x: marginX, y: fy + 20 },
        end: { x: width - marginX, y: fy + 20 },
        thickness: 0.5,
        color: RULE,
      });
      drawCenter(FOOTER_TEXT, width / 2, fy + 8, 8, false, MUTED);
      drawCenter(
        `Sida ${pageIdx} av ${totalPages}`,
        width / 2,
        fy - 4,
        8,
        false,
        MUTED,
      );
    };

    const newPage = () => {
      const p = pdf.addPage(A4);
      pages.push(p);
      setPage(p);
      drawHeader();
      y = height - 100;
    };

    const ensure = (needed: number) => {
      if (y - needed < marginBottom + 20) newPage();
    };

    const wrap = (
      text: string,
      maxWidth: number,
      size: number,
      useBold = false,
    ): string[] => {
      const f = useBold ? bold : font;
      const paragraphs = text.split(/\n/);
      const lines: string[] = [];
      for (const para of paragraphs) {
        if (!para.trim()) {
          lines.push("");
          continue;
        }
        const words = para.split(/\s+/);
        let cur = "";
        for (const w of words) {
          const trial = cur ? cur + " " + w : w;
          if (f.widthOfTextAtSize(sanitize(trial), size) <= maxWidth) {
            cur = trial;
          } else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
      }
      return lines;
    };

    // ===== SIDA 1 =====
    drawHeader();
    y = height - 100;

    // OFFERT-titel + offertnr-badge
    draw("OFFERT", marginX, y - 22, 24, true, INK);
    const badgeW = 170;
    const badgeH = 30;
    const badgeX = width - marginX - badgeW;
    const badgeY = y - 26;
    rect(badgeX, badgeY, badgeW, badgeH, INK);
    drawCenter("OFFERTNUMMER", badgeX + badgeW / 2, badgeY + badgeH - 11, 7, true, WHITE);
    drawCenter(data.offertnr, badgeX + badgeW / 2, badgeY + 8, 12, true, rgb(1, 1, 1));
    y -= 44;

    // Meta-rad
    const metaY = y;
    const metaCol = (width - marginX * 2) / 3;
    const metaCell = (label: string, value: string, i: number) => {
      const x = marginX + metaCol * i;
      draw(label.toUpperCase(), x, metaY, 7, true, MUTED);
      draw(value || "—", x, metaY - 14, 10, true, INK);
    };
    metaCell("Offertdatum", fmtDate(data.offertdatum), 0);
    metaCell("Giltig till", fmtDate(data.giltigTom), 1);
    metaCell("Betalningsvillkor", data.betalningsvillkor, 2);
    y -= 34;

    hr(y);
    y -= 22;

    // ===== KUND / OBJEKT: två boxar =====
    const boxGap = 14;
    const boxW = (width - marginX * 2 - boxGap) / 2;
    const kundRows: [string, string][] = [
      ["Namn", data.kundNamn],
      ["Telefon", data.telefon],
      ["E-post", data.mail],
    ];
    const objRows: [string, string][] = [
      ["Objektadress", data.objektadress],
      ["Fastighetsbeteckning", data.fastighetsbeteckning],
    ];
    const boxRowH = 28;
    const boxHeaderH = 22;
    const boxPad = 14;
    const kundH = boxHeaderH + boxPad + kundRows.length * boxRowH + 6;
    const objH = boxHeaderH + boxPad + objRows.length * boxRowH + 6;
    const boxH = Math.max(kundH, objH);

    const drawInfoBox = (
      x: number,
      title: string,
      rows: [string, string][],
    ) => {
      rect(x, y - boxH, boxW, boxH, undefined, RULE, 0.6);
      rect(x, y - boxHeaderH, boxW, boxHeaderH, SOFT);
      // accent stripe left
      rect(x, y - boxH, 3, boxH, ACCENT);
      draw(title.toUpperCase(), x + 12, y - 15, 8, true, INK);
      let ry = y - boxHeaderH - boxPad;
      for (const [k, v] of rows) {
        draw(k.toUpperCase(), x + 12, ry, 7, true, MUTED);
        draw(v || "—", x + 12, ry - 14, 10, true, INK);
        ry -= boxRowH;
      }
    };
    drawInfoBox(marginX, "Kund", kundRows);
    drawInfoBox(marginX + boxW + boxGap, "Objekt", objRows);
    y -= boxH + 22;

    // ===== INTRO =====
    if (data.intro?.trim()) {
      const introLines = wrap(data.intro, width - marginX * 2, 10);
      for (const ln of introLines) {
        ensure(14);
        draw(ln, marginX, y, 10, false, BODY);
        y -= 14;
      }
      y -= 12;
    }

    // ===== ARBETSBESKRIVNING – tabellrubrik =====
    ensure(40);
    draw("ARBETSBESKRIVNING", marginX, y, 10, true, INK);
    // accentlinje under
    page.drawLine({
      start: { x: marginX, y: y - 4 },
      end: { x: marginX + 60, y: y - 4 },
      thickness: 1.5,
      color: ACCENT,
    });
    y -= 18;

    // Tabellheader
    const tRowNumW = 40;
    const tCol1 = marginX;
    const tCol2 = marginX + tRowNumW;
    const tRight = width - marginX;
    const headerH = 22;
    rect(tCol1, y - headerH, tRight - tCol1, headerH, INK);
    draw("NR", tCol1 + 12, y - 14, 8, true, WHITE);
    draw("BESKRIVNING", tCol2 + 8, y - 14, 8, true, WHITE);
    y -= headerH;

    const beskMaxWidth = tRight - tCol2 - 16;
    let zebra = false;
    for (const rad of data.rader) {
      const lines = wrap(rad.beskrivning, beskMaxWidth, 10);
      const rowH = Math.max(20, lines.length * 13 + 8);
      ensure(rowH + 40); // leave room for totals
      if (zebra) {
        rect(tCol1, y - rowH, tRight - tCol1, rowH, SOFT);
      }
      // radnr som liten "chip"
      draw(String(rad.radnr).padStart(3, "0"), tCol1 + 8, y - 14, 9, true, ACCENT_DARK);
      for (let i = 0; i < lines.length; i++) {
        draw(lines[i], tCol2 + 8, y - 14 - i * 13, 10, false, INK);
      }
      // bottom rule
      page.drawLine({
        start: { x: tCol1, y: y - rowH },
        end: { x: tRight, y: y - rowH },
        thickness: 0.4,
        color: RULE,
      });
      y -= rowH;
      zebra = !zebra;
    }
    y -= 20;

    // ===== TOTALER som kort till höger =====
    const moms = Math.round((data.entreprenadprisExklMoms * data.momsProcent) / 100);
    const summaExklMoms = data.entreprenadprisExklMoms;
    const totaltInklMoms = summaExklMoms + moms;
    const attBetala = totaltInklMoms - data.rotBelopp;

    const totRows: { label: string; value: string; strong?: boolean; sep?: boolean }[] = [
      { label: "Entreprenadpris exkl. moms", value: fmtSek(data.entreprenadprisExklMoms) },
      { label: "Varav materialkostnad", value: fmtSek(data.materialkostnad) },
      { label: `Moms ${data.momsProcent} %`, value: fmtSek(moms), sep: true },
      { label: "Totalt inkl. moms", value: fmtSek(totaltInklMoms), strong: true },
    ];
    if (data.rotBelopp > 0) {
      const rotLabel = data.rotEtikett
        ? `Preliminärt ROT-avdrag ${data.rotEtikett}`
        : "Preliminärt ROT-avdrag";
      totRows.push({ label: rotLabel, value: `-${fmtSek(data.rotBelopp)}`, sep: true });
    }

    const cardW = 300;
    const cardX = width - marginX - cardW;
    const rowH = 20;
    const highlightH = data.rotBelopp > 0 ? 44 : 0;
    const cardH = 14 + totRows.length * rowH + 6 + highlightH;

    ensure(cardH + 10);
    // Card outline
    rect(cardX, y - cardH, cardW, cardH, undefined, RULE, 0.8);
    // Header stripe
    rect(cardX, y - 22, cardW, 22, INK);
    draw("SAMMANSTÄLLNING", cardX + 14, y - 15, 8, true, WHITE);

    let ry = y - 34;
    for (const r of totRows) {
      const size = r.strong ? 11 : 10;
      const color = r.strong ? INK : BODY;
      draw(r.label, cardX + 14, ry, size, r.strong, color);
      drawRight(r.value, cardX + cardW - 14, ry, size, r.strong, color);
      ry -= rowH;
      if (r.sep) {
        page.drawLine({
          start: { x: cardX + 14, y: ry + rowH - 6 },
          end: { x: cardX + cardW - 14, y: ry + rowH - 6 },
          thickness: 0.4,
          color: RULE,
        });
      }
    }

    if (data.rotBelopp > 0) {
      // Highlight-block "Att betala"
      const hy = y - cardH;
      rect(cardX, hy, cardW, highlightH, ACCENT);
      draw("ATT BETALA EFTER ROT", cardX + 14, hy + highlightH - 16, 9, true, rgb(1, 1, 1));
      drawRight(fmtSek(attBetala), cardX + cardW - 14, hy + 14, 16, true, rgb(1, 1, 1));
    }

    y -= cardH + 24;

    // ===== SIDA 2: NOTERINGAR + VILLKOR + SIGNATUR =====
    const hasNoteringar = data.noteringar.some((n) => n.trim());
    const hasVillkor = data.villkor.some((v) => v.rubrik.trim() || v.brodtext.trim());

    if (hasNoteringar || hasVillkor) {
      newPage();

      const sectionHeader = (title: string) => {
        ensure(40);
        draw(title.toUpperCase(), marginX, y, 14, true, INK);
        page.drawLine({
          start: { x: marginX, y: y - 6 },
          end: { x: marginX + 60, y: y - 6 },
          thickness: 1.5,
          color: ACCENT,
        });
        y -= 22;
      };

      if (hasNoteringar) {
        sectionHeader("Övriga noteringar");
        for (const n of data.noteringar) {
          if (!n.trim()) continue;
          const lines = wrap(n, width - marginX * 2 - 18, 10);
          ensure(lines.length * 14 + 6);
          // liten fyrkant som bullet
          rect(marginX + 2, y - 8, 4, 4, ACCENT);
          for (let i = 0; i < lines.length; i++) {
            draw(lines[i], marginX + 16, y - i * 14, 10, false, BODY);
          }
          y -= lines.length * 14 + 8;
        }
        y -= 14;
      }

      if (hasVillkor) {
        sectionHeader("Övriga villkor");
        for (const v of data.villkor) {
          if (!v.rubrik.trim() && !v.brodtext.trim()) continue;
          ensure(36);
          if (v.rubrik.trim()) {
            draw(v.rubrik, marginX, y, 11, true, INK);
            y -= 15;
          }
          if (v.brodtext.trim()) {
            const lines = wrap(v.brodtext, width - marginX * 2, 10);
            for (const ln of lines) {
              ensure(14);
              draw(ln, marginX, y, 10, false, BODY);
              y -= 14;
            }
          }
          y -= 10;
        }
      }

      // ===== SIGNATURRUTA =====
      ensure(120);
      y -= 10;
      draw("GODKÄNNANDE AV OFFERT", marginX, y, 10, true, INK);
      page.drawLine({
        start: { x: marginX, y: y - 4 },
        end: { x: marginX + 60, y: y - 4 },
        thickness: 1.5,
        color: ACCENT,
      });
      y -= 22;
      drawItalic(
        "Vid godkännande av denna offert signeras nedan. Två exemplar; ett behålls av respektive part.",
        marginX,
        y,
        9,
        MUTED,
      );
      y -= 30;

      const sigW = (width - marginX * 2 - 30) / 2;
      const sigY = y - 50;
      // Kund
      page.drawLine({
        start: { x: marginX, y: sigY + 18 },
        end: { x: marginX + sigW, y: sigY + 18 },
        thickness: 0.6,
        color: INK,
      });
      draw("Ort och datum", marginX, sigY + 6, 8, false, MUTED);
      draw("Beställare / kund", marginX, sigY - 6, 8, false, MUTED);
      // Entreprenör
      const eX = marginX + sigW + 30;
      page.drawLine({
        start: { x: eX, y: sigY + 18 },
        end: { x: eX + sigW, y: sigY + 18 },
        thickness: 0.6,
        color: INK,
      });
      draw("Ort och datum", eX, sigY + 6, 8, false, MUTED);
      draw("För RoslagsTak (VT6 Invest AB)", eX, sigY - 6, 8, false, MUTED);
      y = sigY - 20;
    }

    // Rita footer på alla sidor med korrekt sidnr
    const total = pages.length;
    for (let i = 0; i < pages.length; i++) {
      setPage(pages[i]);
      drawFooter(i + 1, total);
    }

    const bytes = await pdf.save();
    const base64 = uint8ToBase64(bytes);
    const filename =
      data.filnamn?.trim() ||
      `RoslagsTak_Offert_${data.offertnr}_${data.kundNamn.replace(/\s+/g, "_")}.pdf`;

    return { filename, base64 };
  });

function sanitize(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/\u2022/g, "•");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
