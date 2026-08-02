export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export interface SignatureParty {
  name: string
  place: string
  date: string
  signaturePng: string | null
  signedAt: string | null
}

export interface SignedPdfMeta {
  documentId: string
  offerNumber: string
  customerEmail: string
  company: SignatureParty
  customer: SignatureParty
  verifiedAt: string | null
  ip: string | null
  userAgent: string | null
}

function sanitize(s: string): string {
  if (!s) return ''
  return s
    .replace(/\r/g, '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
}

/** Appends a signature/evidence page to the base PDF and returns the new bytes. */
export async function buildSignedPdf(
  baseBytes: Uint8Array,
  meta: SignedPdfMeta,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.load(baseBytes)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const page = pdf.addPage([595.28, 841.89])
  const width = page.getWidth()
  const height = page.getHeight()
  const marginX = 50
  const INK = rgb(0, 0, 0)
  const BODY = rgb(0.15, 0.15, 0.15)
  const MUTED = rgb(0.42, 0.42, 0.42)
  const RULE = rgb(0.75, 0.75, 0.75)
  const WHITE = rgb(1, 1, 1)

  const draw = (t: string, x: number, y: number, size = 10, useBold = false, color = BODY) =>
    page.drawText(sanitize(t), { x, y, size, font: useBold ? bold : font, color })

  const drawCenter = (t: string, cx: number, y: number, size = 10, useBold = false, color = BODY) => {
    const f = useBold ? bold : font
    const w = f.widthOfTextAtSize(sanitize(t), size)
    page.drawText(sanitize(t), { x: cx - w / 2, y, size, font: f, color })
  }

  const hr = (y: number) =>
    page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 0.6, color: RULE })

  page.drawRectangle({ x: 0, y: height - 3, width, height: 3, color: INK })
  drawCenter('ROSLAGSTAK', width / 2, height - 44, 26, true, INK)
  drawCenter('Signeringsbevis – digitalt undertecknad offert', width / 2, height - 60, 8, true, INK)
  hr(height - 74)

  let y = height - 108
  draw('SIGNERAD OFFERT', marginX, y, 18, true, INK)
  page.drawLine({ start: { x: marginX, y: y - 6 }, end: { x: marginX + 60, y: y - 6 }, thickness: 1.5, color: INK })
  const badgeW = 170
  const badgeH = 30
  const badgeX = width - marginX - badgeW
  page.drawRectangle({ x: badgeX, y: y - 8, width: badgeW, height: badgeH, color: INK })
  drawCenter('OFFERTNUMMER', badgeX + badgeW / 2, y + badgeH - 19, 7, true, WHITE)
  drawCenter(meta.offerNumber, badgeX + badgeW / 2, y, 12, true, WHITE)
  y -= 40

  const embedSig = async (png: string | null) => {
    if (!png) return null
    try {
      return await pdf.embedPng(base64ToBytes(png))
    } catch {
      return null
    }
  }

  const companyImg = await embedSig(meta.company.signaturePng)
  const customerImg = await embedSig(meta.customer.signaturePng)

  const boxGap = 20
  const boxW = (width - marginX * 2 - boxGap) / 2
  const boxH = 165

  const drawParty = async (
    x: number,
    title: string,
    party: SignatureParty,
    img: any,
    subtitle: string,
  ) => {
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: boxH, borderColor: RULE, borderWidth: 0.6 })
    page.drawRectangle({ x, y: y - 22, width: boxW, height: 22, color: INK })
    draw(title.toUpperCase(), x + 12, y - 15, 8, true, WHITE)

    // signaturbild
    const sigAreaY = y - 100
    if (img) {
      const maxW = boxW - 40
      const maxH = 52
      const scale = Math.min(maxW / img.width, maxH / img.height)
      page.drawImage(img, {
        x: x + 20,
        y: sigAreaY,
        width: img.width * scale,
        height: img.height * scale,
      })
    }
    page.drawLine({
      start: { x: x + 16, y: sigAreaY - 6 },
      end: { x: x + boxW - 16, y: sigAreaY - 6 },
      thickness: 0.6,
      color: INK,
    })
    draw(party.name || '—', x + 16, sigAreaY - 20, 11, true, INK)
    draw(subtitle, x + 16, sigAreaY - 32, 8, false, MUTED)
    draw(`${party.place || '—'}, ${party.date || '—'}`, x + 16, sigAreaY - 46, 9, false, BODY)
  }

  await drawParty(marginX, 'Entreprenör', meta.company, companyImg, 'För RoslagsTak (VT6 Invest AB)')
  await drawParty(marginX + boxW + boxGap, 'Beställare / kund', meta.customer, customerImg, 'Kund')
  y -= boxH + 28

  draw('SIGNERINGSBEVIS', marginX, y, 10, true, INK)
  page.drawLine({ start: { x: marginX, y: y - 4 }, end: { x: marginX + 60, y: y - 4 }, thickness: 1.5, color: INK })
  y -= 22

  const rows: [string, string][] = [
    ['Dokument-ID', meta.documentId],
    ['Offertnummer', meta.offerNumber],
    ['Signerad av entreprenör', `${meta.company.name} – ${meta.company.signedAt ?? '—'}`],
    ['Signerad av kund', `${meta.customer.name} – ${meta.customer.signedAt ?? '—'}`],
    ['Verifieringsmetod', `Engångskod skickad till ${meta.customerEmail}`],
    ['Kod verifierad', meta.verifiedAt ?? '—'],
    ['IP-adress (kund)', meta.ip ?? '—'],
    ['Enhet (kund)', (meta.userAgent ?? '—').slice(0, 90)],
  ]
  for (const [k, v] of rows) {
    draw(k.toUpperCase(), marginX, y, 7, true, MUTED)
    draw(v, marginX + 150, y, 9, false, BODY)
    y -= 18
  }

  y -= 6
  hr(y)
  y -= 16
  draw(
    'Detta dokument har undertecknats elektroniskt av båda parter. Signeringsbeviset ovan utgör underlag för',
    marginX,
    y,
    8,
    false,
    MUTED,
  )
  y -= 11
  draw(
    'identifiering av undertecknarna. Båda parter har erhållit ett identiskt exemplar av det signerade dokumentet.',
    marginX,
    y,
    8,
    false,
    MUTED,
  )

  page.drawLine({ start: { x: marginX, y: 60 }, end: { x: width - marginX, y: 60 }, thickness: 0.5, color: RULE })
  drawCenter(
    'RoslagsTak (VT6 Invest AB)   ·   Org.nr 559539-3595   ·   Momsnr SE559539359501   ·   Godkänd för F-skatt',
    width / 2,
    48,
    8,
    false,
    MUTED,
  )

  return await pdf.save()
}

