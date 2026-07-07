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

const FOOTER_TEXT =
  "RoslagsTak (VT6 Invest AB) | Org.nr 559539-3595 | Momsnr SE559539359501 | Godkänd för F-skatt";

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
  // Return as-is if already ISO-like
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

    const A4: [number, number] = [595.28, 841.89];
    const marginX = 55;
    const marginTop = 55;
    const marginBottom = 70;

    let page = pdf.addPage(A4);
    let { width, height } = { width: page.getWidth(), height: page.getHeight() };
    let y = height - marginTop;

    const BLACK = rgb(0, 0, 0);
    const RULE = rgb(0.15, 0.15, 0.15);
    const MUTED = rgb(0.35, 0.35, 0.35);

    const draw = (
      text: string,
      x: number,
      yy: number,
      size = 10,
      useBold = false,
      color = BLACK,
    ) => {
      page.drawText(sanitize(text), {
        x,
        y: yy,
        size,
        font: useBold ? bold : font,
        color,
      });
    };

    const drawRight = (
      text: string,
      xRight: number,
      yy: number,
      size = 10,
      useBold = false,
      color = BLACK,
    ) => {
      const t = sanitize(text);
      const f = useBold ? bold : font;
      const w = f.widthOfTextAtSize(t, size);
      page.drawText(t, { x: xRight - w, y: yy, size, font: f, color });
    };

    const hr = (yy: number, color = RULE, thickness = 0.6) => {
      page.drawLine({
        start: { x: marginX, y: yy },
        end: { x: width - marginX, y: yy },
        thickness,
        color,
      });
    };

    const drawFooter = () => {
      const fy = 40;
      page.drawLine({
        start: { x: marginX, y: fy + 14 },
        end: { x: width - marginX, y: fy + 14 },
        thickness: 0.5,
        color: RULE,
      });
      draw(FOOTER_TEXT, marginX, fy, 9, false, MUTED);
    };

    const newPage = () => {
      drawFooter();
      page = pdf.addPage(A4);
      width = page.getWidth();
      height = page.getHeight();
      y = height - marginTop;
    };

    const ensure = (needed: number) => {
      if (y - needed < marginBottom) newPage();
    };

    // Word wrap helper
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

    // ===== HEADER =====
    draw("ROSLAGSTAK", marginX, y - 24, 30, true);
    y -= 34;
    draw("OFFERT", marginX, y - 20, 20, true);
    y -= 32;

    // Meta row: 3 kolumner
    const colW = (width - marginX * 2) / 3;
    draw(`Offertnr: ${data.offertnr}`, marginX, y, 10);
    draw(`Offertdatum: ${fmtDate(data.offertdatum)}`, marginX + colW, y, 10);
    draw(`Giltig tom: ${fmtDate(data.giltigTom)}`, marginX + colW * 2, y, 10);
    y -= 16;
    draw(`Betalningsvillkor: ${data.betalningsvillkor}`, marginX, y, 10);
    y -= 24;

    // Kund
    draw("Kund", marginX, y, 12, true);
    y -= 16;
    const kundRows: [string, string][] = [
      ["Namn", data.kundNamn],
      ["Objektadress", data.objektadress],
      ["Telefon", data.telefon],
      ["Mail", data.mail],
      ["Fastighetsbeteckning", data.fastighetsbeteckning],
    ];
    for (const [k, v] of kundRows) {
      if (!v) continue;
      draw(`${k}: ${v}`, marginX, y, 10);
      y -= 14;
    }
    y -= 8;
    hr(y);
    y -= 18;

    // Intro
    if (data.intro?.trim()) {
      draw(data.intro, marginX, y, 10);
      y -= 22;
    }

    // Rader-tabell
    const colRad = marginX;
    const colBesk = marginX + 60;
    draw("Rad", colRad, y, 10, true);
    draw("Beskrivning", colBesk, y, 10, true);
    y -= 6;
    hr(y);
    y -= 14;

    const beskMaxWidth = width - marginX - colBesk;
    for (const rad of data.rader) {
      const lines = wrap(rad.beskrivning, beskMaxWidth, 10);
      const needed = Math.max(14, lines.length * 13);
      ensure(needed);
      draw(String(rad.radnr), colRad, y, 10);
      for (let i = 0; i < lines.length; i++) {
        draw(lines[i], colBesk, y - i * 13, 10);
      }
      y -= needed;
    }
    y -= 10;

    // ===== TOTALER (nere till höger) =====
    const moms = Math.round((data.entreprenadprisExklMoms * data.momsProcent) / 100);
    const summaExklMoms = data.entreprenadprisExklMoms;
    const totaltInklMoms = summaExklMoms + moms;
    const attBetala = totaltInklMoms - data.rotBelopp;

    const totRows: { label: string; value: string; bold?: boolean; rule?: boolean }[] = [
      { label: "Entreprenadpris exkl. moms", value: fmtSek(data.entreprenadprisExklMoms) },
      { label: "Materialkostnad", value: fmtSek(data.materialkostnad) },
      { label: "Summa exkl. moms", value: fmtSek(summaExklMoms) },
      { label: `Moms ${data.momsProcent} %`, value: fmtSek(moms) },
      { label: "Totalt inkl. moms", value: fmtSek(totaltInklMoms) },
    ];
    if (data.rotBelopp > 0) {
      const rotLabel = data.rotEtikett
        ? `Preliminärt ROT-avdrag ${data.rotEtikett}`
        : "Preliminärt ROT-avdrag";
      totRows.push({ label: rotLabel, value: `-${fmtSek(data.rotBelopp)}`, rule: true });
      totRows.push({ label: "ATT BETALA EFTER ROT", value: fmtSek(attBetala), bold: true });
    }

    const totBlockHeight = totRows.length * 20 + 14;
    ensure(totBlockHeight);

    const totLeft = width / 2 + 10;
    const totRight = width - marginX;
    // Övre linje för totalblock
    page.drawLine({
      start: { x: totLeft, y: y + 6 },
      end: { x: totRight, y: y + 6 },
      thickness: 0.6,
      color: RULE,
    });
    for (const r of totRows) {
      const size = r.bold ? 11 : 10;
      draw(r.label, totLeft, y - 6, size, r.bold);
      drawRight(r.value, totRight, y - 6, size, r.bold);
      y -= 20;
      if (r.rule) {
        page.drawLine({
          start: { x: totLeft, y: y + 8 },
          end: { x: totRight, y: y + 8 },
          thickness: 0.6,
          color: RULE,
        });
      }
    }

    // ===== SIDA 2: NOTERINGAR + VILLKOR =====
    const hasNoteringar = data.noteringar.some((n) => n.trim());
    const hasVillkor = data.villkor.some((v) => v.rubrik.trim() || v.brodtext.trim());
    if (hasNoteringar || hasVillkor) {
      newPage();

      if (hasNoteringar) {
        draw("Övriga noteringar", marginX, y, 18, true);
        y -= 24;
        for (const n of data.noteringar) {
          if (!n.trim()) continue;
          const lines = wrap(n, width - marginX * 2 - 14, 10);
          ensure(lines.length * 14 + 4);
          draw("•", marginX, y, 10, true);
          for (let i = 0; i < lines.length; i++) {
            draw(lines[i], marginX + 14, y - i * 14, 10);
          }
          y -= lines.length * 14 + 4;
        }
        y -= 10;
      }

      if (hasVillkor) {
        ensure(30);
        draw("Övriga villkor", marginX, y, 18, true);
        y -= 22;
        for (const v of data.villkor) {
          if (!v.rubrik.trim() && !v.brodtext.trim()) continue;
          ensure(30);
          if (v.rubrik.trim()) {
            draw(v.rubrik, marginX, y, 11, true);
            y -= 16;
          }
          if (v.brodtext.trim()) {
            const lines = wrap(v.brodtext, width - marginX * 2, 10);
            for (const ln of lines) {
              ensure(14);
              draw(ln, marginX, y, 10);
              y -= 14;
            }
          }
          y -= 8;
        }
      }
    }

    drawFooter();

    const bytes = await pdf.save();
    const base64 = uint8ToBase64(bytes);
    const filename =
      data.filnamn?.trim() ||
      `RoslagsTak_Offert_${data.offertnr}_${data.kundNamn.replace(/\s+/g, "_")}.pdf`;

    return { filename, base64 };
  });

// Ersätt tecken som Helvetica (WinAnsi) inte klarar
function sanitize(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r/g, "")
    .replace(/[\u2013\u2014]/g, "-") // – —
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
  // btoa exists in both browser and Workers runtime
  return btoa(binary);
}
