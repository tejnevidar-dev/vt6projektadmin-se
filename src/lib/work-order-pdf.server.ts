// Arbetsorder som PDF: svenska först, engelska på nästa sida (baltiska lag). Inga kundpriser.
import { COMPANY_NAME_TO_UE, WO_TEXT, type Lang, type WorkOrderContent } from "@/lib/work-order";

export interface WorkOrderPdfInput {
  content: WorkOrderContent;
  uePrice: number | null;
  startDate: string | null;
  deadline?: string | null;
}

const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

export async function buildWorkOrderPdf(input: WorkOrderPdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const lang of ["sv", "en"] as Lang[]) {
    const t = WO_TEXT[lang];
    const c = input.content;
    let page = pdf.addPage([595.28, 841.89]);
    let y = 790;
    const x = 50;
    const line = (text: string, o: { b?: boolean; size?: number; gap?: number } = {}) => {
      const size = o.size ?? 10.5;
      if (y < 60) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      // Standardtypsnitt klarar bara WinAnsi; ersätt tecken utanför.
      const safe = text.replace(/[^ -ÿ]/g, "?");
      page.drawText(safe.slice(0, 110), { x, y, size, font: o.b ? bold : font, color: rgb(0.1, 0.1, 0.1) });
      y -= o.gap ?? size + 5;
    };

    line(t.title + (c.offer_number ? ` – ${c.offer_number}` : ""), { b: true, size: 20, gap: 28 });
    line(t.from, { gap: 20 });
    line(t.address, { b: true });
    line(c.address, { gap: 16 });
    line(t.price, { b: true });
    line(input.uePrice != null ? kr(input.uePrice) : t.none, { gap: 6 });
    line(t.binding, { size: 9, gap: 16 });
    if (input.startDate) {
      line(t.start, { b: true });
      line(input.startDate, { gap: 16 });
    }
    if (c.roof_area_kvm) {
      line(t.area, { b: true });
      line(`${c.roof_area_kvm} m2`, { gap: 16 });
    }
    if (c.ranndalar_meter) {
      line(t.gutters, { b: true });
      line(String(c.ranndalar_meter), { gap: 16 });
    }
    line(t.scope, { b: true });
    if (!c.scope.length) line(t.none);
    for (const s of c.scope) line(`- ${s.label}: ${s.quantity} ${s.unit}`);
    y -= 10;
    line(t.materials, { b: true });
    if (!c.materials.length) line(t.none);
    for (const m of c.materials) line(`- ${m.label}: ${m.quantity} ${m.unit}`);
    y -= 10;
    line(t.contact, { b: true });
    line([c.contact.name, c.contact.phone, c.contact.email].filter(Boolean).join(" | "), { gap: 16 });
    if (c.attachments.length) {
      line(t.attachments, { b: true });
      for (const a of c.attachments) line(`- ${a.name}`);
      y -= 10;
    }
    if (c.notes) {
      line(t.notes, { b: true });
      for (const l of c.notes.split("\n").slice(0, 12)) line(l);
    }
    if (input.deadline) {
      y -= 10;
      line(`${t.valid}: ${input.deadline}`, { b: true });
    }
    page.drawText(COMPANY_NAME_TO_UE, { x, y: 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return await pdf.save();
}
