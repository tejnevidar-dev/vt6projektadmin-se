// Arbetsorder som PDF: svenska först, engelska på nästa sida (baltiska lag). Inga kundpriser.
// Genereras per erbjudande (UE:s namn och org.nr) och som accepterad version efter accept.
import {
  COMPANY_NAME_TO_UE,
  STANDARD_TASK_KEYS,
  WO_TEXT,
  termsLines,
  toWinAnsi,
  wrapText,
  type Lang,
  type Personnel,
  type WorkOrderContent,
} from "@/lib/work-order";

export interface WorkOrderPdfInput {
  content: WorkOrderContent;
  uePrice: number | null;
  startDate: string | null;
  endDate?: string | null;
  orderNumber?: string | null;
  subcontractor?: { name: string; orgNumber: string | null } | null;
  frameworkDate?: string | null;
  deadline?: string | null;
  clientOrgNumber?: string | null;
  accepted?: { by: string; at: string; personnel: Personnel[] } | null;
}

const kr = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;

export async function buildWorkOrderPdf(input: WorkOrderPdfInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const X = 50;
  const maxW = W - 2 * X;

  for (const lang of ["sv", "en"] as Lang[]) {
    const t = WO_TEXT[lang];
    const c = input.content;
    let page = pdf.addPage([W, H]);
    let y = 790;

    const line = (text: string, o: { b?: boolean; size?: number; gap?: number; indent?: number } = {}) => {
      const size = o.size ?? 10.5;
      const f = o.b ? bold : font;
      const indent = o.indent ?? 0;
      const safe = toWinAnsi(text);
      for (const l of wrapText(safe, maxW - indent, (s) => f.widthOfTextAtSize(s, size))) {
        if (y < 70) {
          page = pdf.addPage([W, H]);
          y = 790;
        }
        page.drawText(l, { x: X + indent, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= size + 4;
      }
      y -= (o.gap ?? 4) - 4 > 0 ? (o.gap ?? 4) - 4 : 0;
    };

    line(`${t.title}${input.orderNumber ? ` ${input.orderNumber}` : ""}`, { b: true, size: 20, gap: 26 });
    line(`${t.from}${input.clientOrgNumber ? ` (${t.orgNo} ${input.clientOrgNumber})` : ""}`, { gap: 8 });
    if (input.subcontractor) {
      line(`${t.subcontractor}: ${input.subcontractor.name}${input.subcontractor.orgNumber ? ` (${t.orgNo} ${input.subcontractor.orgNumber})` : ""}`, { gap: 16 });
    }
    line(t.address, { b: true });
    line(c.address, { gap: 14 });
    line(t.price, { b: true });
    line(input.uePrice != null ? kr(input.uePrice) : t.none, { gap: 4 });
    line(t.binding, { size: 9, gap: 14 });
    if (c.price_breakdown?.length) {
      line(t.breakdown, { b: true });
      for (const p of c.price_breakdown) line(`- ${p.label}: ${kr(p.amount)}`);
      y -= 8;
    }
    line(`${t.start}: ${input.startDate ?? t.none}`, { b: true });
    line(`${t.end}: ${input.endDate ?? t.none}`, { b: true, gap: 14 });
    if (c.roof_area_kvm) line(`${t.area}: ${c.roof_area_kvm} m2`, { gap: 6 });
    if (c.storeys) line(`${t.storeys}: ${c.storeys}`, { gap: 6 });
    if (c.pitch) line(`${t.pitch}: ${c.pitch}`, { gap: 6 });
    if (c.ranndalar_meter) line(`${t.valleys}: ${c.ranndalar_meter}`, { gap: 6 });
    y -= 6;

    line(t.standardTasks, { b: true });
    for (const k of c.standard_tasks?.length ? c.standard_tasks : [...STANDARD_TASK_KEYS]) {
      line(`- ${t[`task_${k}`] ?? k}`, { indent: 6 });
    }
    y -= 6;
    line(t.scope, { b: true });
    if (!c.scope.length) line(t.none, { indent: 6 });
    for (const s of c.scope) line(`- ${s.label}: ${s.quantity} ${s.unit}`, { indent: 6 });
    y -= 6;
    line(t.materials, { b: true });
    if (!c.materials.length) line(t.none, { indent: 6 });
    for (const m of c.materials) line(`- ${m.label}: ${m.quantity} ${m.unit}`, { indent: 6 });
    if (c.material_delivery_date) line(`${t.materialDelivery}: ${c.material_delivery_date}`, { gap: 6 });
    y -= 6;
    line(t.contact, { b: true });
    line([c.contact.name, c.contact.phone, c.contact.email].filter(Boolean).join(" | "), { gap: 12 });
    if (c.attachments.length) {
      line(t.attachments, { b: true });
      for (const a of c.attachments) line(`- ${a.name}`, { indent: 6 });
      y -= 6;
    }
    if (c.notes) {
      line(t.notes, { b: true });
      line(c.notes.slice(0, 1500), { gap: 8 });
    }

    line(t.termsTitle, { b: true, gap: 6 });
    for (const term of termsLines(lang, { subcontractorName: input.subcontractor?.name ?? null, frameworkDate: input.frameworkDate ?? null, content: c as any })) {
      line(`- ${term}`, { size: 9.5, indent: 6, gap: 6 });
    }
    if (input.deadline && !input.accepted) {
      y -= 6;
      line(`${t.valid}: ${input.deadline}`, { b: true });
    }
    if (input.accepted) {
      y -= 8;
      line(`${t.acceptedBy}: ${input.accepted.by}`, { b: true });
      line(`${t.acceptedAt}: ${input.accepted.at}`, { b: true });
      const emp = input.accepted.personnel.filter((p) => p.status === "employee").length;
      const self = input.accepted.personnel.length - emp;
      line(`${t.personnel}: ${emp} ${t.employee.toLowerCase()}, ${self} ${t.selfEmployed.toLowerCase()}`, { gap: 6 });
    }
  }

  // Sidfot: "VT6 Invest AB | org.nr | Arbetsorder nr | sida x/y"
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const foot = toWinAnsi(
      [
        `${COMPANY_NAME_TO_UE} AB`,
        input.clientOrgNumber ? `${WO_TEXT.sv.orgNo} ${input.clientOrgNumber}` : "",
        input.orderNumber ? `${WO_TEXT.sv.footer} ${input.orderNumber}` : WO_TEXT.sv.footer,
        `${WO_TEXT.sv.page} ${i + 1}/${pages.length}`,
      ]
        .filter(Boolean)
        .join(" | "),
    );
    p.drawText(foot, { x: X, y: 30, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
  });
  return await pdf.save();
}
