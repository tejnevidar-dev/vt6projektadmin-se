// Lägger till kundvillkoren (ångerrätt, byggherreansvar, garanti, ångerblankett) som extra sidor
// sist i offert-PDF:en, en sida per block. Anropas bara när isCustomerTermsReady(cfg) är sant
// (se customer-terms.ts) - annars rörs PDF:en inte alls. Samma wrapText/toWinAnsi-mönster som
// work-order-pdf.server.ts/ue-agreement-pdf.server.ts, men laddar (inte skapar) basdokumentet,
// samma teknik som buildSignedPdf använder för att lägga till en signatursida.
import { toWinAnsi, wrapText } from "@/lib/work-order";
import type { CustomerTermsConfig } from "@/lib/customer-terms";

export async function appendCustomerTermsPages(baseBytes: Uint8Array, cfg: CustomerTermsConfig): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(baseBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const X = 50;
  const maxW = W - 2 * X;

  const sections: { title: string; body: string | null }[] = [
    { title: "Ångerrätt", body: cfg.angerratt_text },
    { title: "Överlåtelse av byggherreansvar", body: cfg.byggherreansvar_text },
    { title: "Garanti", body: cfg.garanti_text },
    { title: "Ångerblankett", body: cfg.angerblankett_text },
  ];

  for (const section of sections) {
    if (!section.body?.trim()) continue;
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

    line(section.title, { b: true, size: 14 });
    y -= 8;
    for (const paragraph of section.body.split("\n")) line(paragraph);
  }

  return pdf.save();
}
