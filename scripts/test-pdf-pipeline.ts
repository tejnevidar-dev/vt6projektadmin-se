#!/usr/bin/env node
/**
 * Självtest för PDF-bildkedjan i egenkontroll-mejlet.
 *
 * Kör samma prepareImageForPdf() som send-self-checks.ts använder, bygger
 * en PDF med pdf-lib (PNG med alpha + stor JPEG + liten PNG), och
 * verifierar att:
 *   1. pdf-lib accepterar de prepped byten (ingen "SOI not found")
 *   2. den färdiga PDF:en parsas tillbaka och innehåller XObject-bilder
 *   3. de inbäddade bildernas dimensioner matchar förväntad nedskalning
 *
 * Körs med: bun run test:pdf  (eller node --import tsx scripts/test-pdf-pipeline.ts)
 */
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { prepareImageForPdf, PdfImageError, PDF_IMAGE_MAX_EDGE } from "../src/lib/pdf-image";

function makePng(w: number, h: number, r: number, g: number, b: number, alpha = 255): Uint8Array {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = alpha;
  }
  return new Uint8Array(PNG.sync.write(png));
}

function makeJpeg(w: number, h: number, r: number, g: number, b: number): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return new Uint8Array(jpeg.encode({ data, width: w, height: h }, 90).data);
}

interface Case {
  label: string;
  bytes: Uint8Array;
  origDims: [number, number];
  expectedEdge: number;
}

const cases: Case[] = [
  { label: "iPhone PNG med alpha (3024x4032)", bytes: makePng(3024, 4032, 255, 80, 80, 200), origDims: [3024, 4032], expectedEdge: PDF_IMAGE_MAX_EDGE },
  { label: "iPhone JPEG (3024x4032)",         bytes: makeJpeg(3024, 4032, 80, 200, 80),       origDims: [3024, 4032], expectedEdge: PDF_IMAGE_MAX_EDGE },
  { label: "Liten PNG (640x480, ingen scale)", bytes: makePng(640, 480, 80, 80, 255),          origDims: [640, 480],   expectedEdge: 640 },
];

const failures: string[] = [];

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page = pdf.addPage([595.28, 841.89]);
page.drawText("Egenkontroll PDF-pipe selftest", { x: 50, y: 800, size: 16, font });

let y = 760;
const embedded: { label: string; w: number; h: number; bytes: number }[] = [];

for (const c of cases) {
  const prepped = prepareImageForPdf(c.bytes);
  let img;
  try {
    img = await pdf.embedJpg(prepped);
  } catch (e) {
    try {
      img = await pdf.embedPng(prepped);
    } catch (e2) {
      failures.push(`${c.label}: pdf-lib avvisade prepared bytes: ${(e as Error).message} / ${(e2 as Error).message}`);
      continue;
    }
  }
  const longest = Math.max(img.width, img.height);
  if (Math.abs(longest - c.expectedEdge) > 2) {
    failures.push(`${c.label}: förväntade längsta sidan ~${c.expectedEdge}px, fick ${longest}px`);
  }
  const scale = Math.min(220 / img.width, 220 / img.height, 1);
  page.drawImage(img, { x: 50, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
  embedded.push({ label: c.label, w: img.width, h: img.height, bytes: prepped.length });
  y -= 240;
}

const pdfBytes = await pdf.save();

// Tolkningstest: ladda PDF:en igen och räkna antalet inbäddade bilder.
const reopened = await PDFDocument.load(pdfBytes);
const reopenedPages = reopened.getPages();
if (reopenedPages.length === 0) failures.push("Återöppnad PDF har 0 sidor");

const xObjectCount = (() => {
  // Genvägstest: räkna /Image XObjects i råa PDF-byten.
  const text = Buffer.from(pdfBytes).toString("latin1");
  const matches = text.match(/\/Subtype\s*\/Image/g) ?? [];
  return matches.length;
})();
if (xObjectCount < cases.length) {
  failures.push(`Förväntade minst ${cases.length} bild-XObjects i PDF, hittade ${xObjectCount}`);
}

console.log("Resultat:");
for (const e of embedded) {
  console.log(`  - ${e.label}: ${e.w}x${e.h}, ${(e.bytes / 1024).toFixed(1)} kB`);
}
console.log(`  PDF-storlek: ${(pdfBytes.length / 1024).toFixed(1)} kB`);
console.log(`  /Subtype /Image-poster: ${xObjectCount}`);

if (failures.length > 0) {
  console.error("\n FEL:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nSjälvtest OK — alla bilder accepteras och bäddas in i PDF:en.");
