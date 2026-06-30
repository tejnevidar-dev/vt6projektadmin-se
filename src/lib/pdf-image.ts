import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";

export const PDF_IMAGE_MAX_EDGE = 1400;
export const PDF_IMAGE_JPEG_QUALITY = 72;

export type PdfImageFailureStage =
  | "unsupported-format"
  | "decode"
  | "downscale"
  | "flatten"
  | "encode";

export class PdfImageError extends Error {
  readonly stage: PdfImageFailureStage;
  readonly format: "jpeg" | "png" | "unknown";
  readonly byteLength: number;
  readonly cause?: unknown;

  constructor(
    stage: PdfImageFailureStage,
    format: "jpeg" | "png" | "unknown",
    byteLength: number,
    message: string,
    cause?: unknown,
  ) {
    super(`[pdf-image:${stage}] ${message} (format=${format}, bytes=${byteLength})`);
    this.name = "PdfImageError";
    this.stage = stage;
    this.format = format;
    this.byteLength = byteLength;
    this.cause = cause;
  }
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function detectFormat(bytes: Uint8Array): "jpeg" | "png" | "unknown" {
  if (isJpeg(bytes)) return "jpeg";
  if (isPng(bytes)) return "png";
  return "unknown";
}

function downscaleRgbaNearest(
  data: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Uint8Array {
  const out = new Uint8Array(dstWidth * dstHeight * 4);
  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / dstHeight));
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / dstWidth));
      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const dstIdx = (y * dstWidth + x) * 4;
      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3] ?? 255;
    }
  }
  return out;
}

/**
 * Decodes a phone-uploaded PNG or JPEG, flattens transparency against white,
 * downscales to PDF_IMAGE_MAX_EDGE, and re-encodes as a compact JPEG that
 * pdf-lib's embedJpg() accepts (clean Uint8Array, not a Node Buffer pool view).
 *
 * Throws PdfImageError with a specific `stage` when anything fails, so callers
 * can report exactly *why* a given file could not be embedded instead of
 * silently shipping the original bytes (which previously caused pdf-lib to
 * crash later with the unhelpful "SOI not found in JPEG").
 */
export function prepareImageForPdf(bytes: Uint8Array): Uint8Array {
  const format = detectFormat(bytes);
  if (format === "unknown") {
    throw new PdfImageError(
      "unsupported-format",
      format,
      bytes.length,
      "Filen är varken JPEG eller PNG (magic bytes matchar inte). Endast bilder från kameran/galleriet stöds.",
    );
  }

  let decoded: { width: number; height: number; data: Uint8Array | Buffer };
  try {
    decoded =
      format === "jpeg"
        ? jpeg.decode(bytes, {
            useTArray: true,
            tolerantDecoding: true,
            maxMemoryUsageInMB: 768,
          })
        : PNG.sync.read(Buffer.from(bytes));
  } catch (err) {
    throw new PdfImageError(
      "decode",
      format,
      bytes.length,
      `Kunde inte avkoda bilden: ${(err as Error).message}`,
      err,
    );
  }

  if (!decoded || !decoded.width || !decoded.height || !decoded.data?.length) {
    throw new PdfImageError(
      "decode",
      format,
      bytes.length,
      `Avkodning gav tom bild (width=${decoded?.width}, height=${decoded?.height}, data=${decoded?.data?.length ?? 0}).`,
    );
  }

  let width = decoded.width;
  let height = decoded.height;
  let data: Uint8Array = decoded.data instanceof Uint8Array ? decoded.data : new Uint8Array(decoded.data);

  const longest = Math.max(width, height);
  const scale = Math.min(1, PDF_IMAGE_MAX_EDGE / longest);
  if (scale < 1) {
    const newW = Math.max(1, Math.round(width * scale));
    const newH = Math.max(1, Math.round(height * scale));
    try {
      data = downscaleRgbaNearest(data, width, height, newW, newH);
      width = newW;
      height = newH;
    } catch (err) {
      throw new PdfImageError(
        "downscale",
        format,
        bytes.length,
        `Nedskalning misslyckades (${decoded.width}x${decoded.height} → ${newW}x${newH}): ${(err as Error).message}`,
        err,
      );
    }
  }

  let flattened: Uint8Array;
  try {
    flattened = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const src = i * 4;
      const alpha = (data[src + 3] ?? 255) / 255;
      flattened[src] = Math.round((data[src] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 1] = Math.round((data[src + 1] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 2] = Math.round((data[src + 2] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 3] = 255;
    }
  } catch (err) {
    throw new PdfImageError(
      "flatten",
      format,
      bytes.length,
      `Alfa-flattening misslyckades (${width}x${height}): ${(err as Error).message}`,
      err,
    );
  }

  try {
    const encoded = jpeg.encode({ data: flattened, width, height }, PDF_IMAGE_JPEG_QUALITY);
    // Node Buffer shares an underlying ArrayBuffer pool, so pdf-lib's DataView
    // reads from the wrong offset ("SOI not found in JPEG"). Copy out.
    return new Uint8Array(encoded.data);
  } catch (err) {
    throw new PdfImageError(
      "encode",
      format,
      bytes.length,
      `JPEG-omkodning misslyckades (${width}x${height}): ${(err as Error).message}`,
      err,
    );
  }
}
