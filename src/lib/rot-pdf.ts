import type { Lead } from "@/lib/types";
import { completedLeads } from "@/lib/economy-analytics";

// pdf-lib works fine directly in the browser (no server round-trip needed, unlike
// signing-pdf.server.ts which is server-only because it fetches signature images
// from Storage) -- generated and downloaded client-side, same as rotCsv/economyCsv.

function sanitize(s: string): string {
  return (s ?? "").replace(/\r/g, "");
}

/** Skriver ut ROT-underlag (period, kund, personnummer, fastighet, belopp) som PDF. */
export async function buildRotPdf(leads: Lead[], periodLabel: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const rows = completedLeads(leads).filter((l) => l.rotEligible && (l.rotAmount ?? 0) > 0);

  const marginX = 40;
  const pageSize: [number, number] = [841.89, 595.28]; // A4 liggande
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - 50;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - 50;
  };

  page.drawText("ROT-underlag", { x: marginX, y, size: 16, font: bold, color: rgb(0, 0, 0) });
  y -= 20;
  page.drawText(sanitize(periodLabel), { x: marginX, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 30;

  const cols = [
    { label: "Kund", x: marginX, w: 140 },
    { label: "Personnummer", x: marginX + 140, w: 100 },
    { label: "Fastighet", x: marginX + 240, w: 130 },
    { label: "Pris inkl moms", x: marginX + 370, w: 90 },
    { label: "ROT-belopp", x: marginX + 460, w: 90 },
    { label: "Fakturadatum", x: marginX + 550, w: 90 },
    { label: "Ansökt", x: marginX + 640, w: 60 },
  ];

  const drawHeader = () => {
    for (const c of cols) page.drawText(c.label, { x: c.x, y, size: 9, font: bold, color: rgb(0, 0, 0) });
    y -= 6;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: pageSize[0] - marginX, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 14;
  };

  drawHeader();
  let totalRot = 0;
  for (const l of rows) {
    if (y < 60) {
      newPage();
      drawHeader();
    }
    const values = [
      l.name,
      l.personalNumber ?? "",
      l.propertyDesignation ?? "",
      `${Math.round(l.price ?? 0).toLocaleString("sv-SE")} kr`,
      `${Math.round(l.rotAmount ?? 0).toLocaleString("sv-SE")} kr`,
      l.invoicedAt ? new Date(l.invoicedAt).toLocaleDateString("sv-SE") : "",
      l.rotPaid ? "Ja" : "Nej",
    ];
    for (let i = 0; i < cols.length; i++) {
      page.drawText(sanitize(String(values[i] ?? "")), { x: cols[i].x, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    }
    totalRot += Math.round(l.rotAmount ?? 0);
    y -= 16;
  }

  y -= 10;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageSize[0] - marginX, y },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.6),
  });
  y -= 16;
  page.drawText(`Totalt ROT-belopp: ${totalRot.toLocaleString("sv-SE")} kr (${rows.length} st)`, {
    x: marginX,
    y,
    size: 10,
    font: bold,
    color: rgb(0, 0, 0),
  });

  return pdf.save();
}
