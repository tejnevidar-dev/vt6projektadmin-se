// Ramavtalet (UE) som PDF – enkel markdown-lite-rendering av den ifyllda avtalstexten
// (fillUeAgreement()). Samma WinAnsi/radbrytningshjälpare som arbetsordern (work-order.ts),
// ingen egen fontlogik. Bara svenska - ramavtalet har inte samma tvåspråkiga krav som
// arbetsordern (UE:s eget avtal, inte en dokumentation för utländsk personal på plats).
import { toWinAnsi, wrapText } from "@/lib/work-order";

export async function buildUeAgreementPdf(filledText: string): Promise<Uint8Array> {
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

  const line = (text: string, o: { b?: boolean; size?: number; gap?: number; indent?: number } = {}) => {
    const size = o.size ?? 10.5;
    const f = o.b ? bold : font;
    const indent = o.indent ?? 0;
    const safe = toWinAnsi(text);
    for (const l of wrapText(safe, maxW - indent, (s) => f.widthOfTextAtSize(s, size))) {
      if (y < 60) {
        page = pdf.addPage([W, H]);
        y = 790;
      }
      page.drawText(l, { x: X + indent, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    }
    y -= (o.gap ?? 4) - 4 > 0 ? (o.gap ?? 4) - 4 : 0;
  };

  for (const raw of filledText.split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) {
      y -= 4;
      continue;
    }
    const plain = l.replace(/\*\*/g, "");
    if (plain.startsWith("# ")) {
      line(plain.slice(2), { b: true, size: 16, gap: 18 });
    } else if (plain.startsWith("## ")) {
      y -= 6;
      line(plain.slice(3), { b: true, size: 12.5, gap: 10 });
    } else if (plain.startsWith("  - ")) {
      line(`- ${plain.slice(4)}`, { indent: 10 });
    } else {
      line(plain);
    }
  }

  return pdf.save();
}
