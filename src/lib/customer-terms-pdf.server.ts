// Bygger de två separata kundvillkors-PDF:erna (utöver själva offert-PDF:en):
// "Allmänna villkor" och "Information om ångerrätt + ångerblankett" - se kundvillkor-v1.md
// avsnitt 1, steg A: "tre PDF:er: offerten, Allmänna villkor och Information om ångerrätt +
// ångerblankett". Anropas bara när isCustomerTermsReady(cfg) är sant (se customer-terms.ts).
// Samma wrapText/toWinAnsi-mönster som ue-agreement-pdf.server.ts/work-order-pdf.server.ts.
import { toWinAnsi, wrapText } from "@/lib/work-order";

async function renderTextPdf(sections: { title: string; body: string }[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const X = 50;
  const maxW = W - 2 * X;

  let page = pdf.addPage([W, H]);
  let y = 790;

  const line = (text: string, o: { b?: boolean; size?: number } = {}) => {
    const size = o.size ?? 10.5;
    const f = o.b ? bold : font;
    for (const l of wrapText(toWinAnsi(text), maxW, (s) => f.widthOfTextAtSize(s, size))) {
      if (y < 60) {
        page = pdf.addPage([W, H]);
        y = 790;
      }
      page.drawText(l, { x: X, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    }
  };

  for (const section of sections) {
    if (!section.body?.trim()) continue;
    if (y < 730) {
      page = pdf.addPage([W, H]);
      y = 790;
    }
    line(section.title, { b: true, size: 15 });
    y -= 10;
    for (const paragraph of section.body.split("\n")) line(paragraph);
    y -= 14;
  }

  return pdf.save();
}

export async function buildAllmannaVillkorPdf(text: string): Promise<Uint8Array> {
  return renderTextPdf([{ title: "Allmänna villkor – takarbeten för konsument", body: text }]);
}

export async function buildAngerrattPdf(angerrattText: string, angerblankettText: string): Promise<Uint8Array> {
  return renderTextPdf([
    { title: "Information om ångerrätt", body: angerrattText },
    { title: "Ångerblankett", body: angerblankettText },
  ]);
}
