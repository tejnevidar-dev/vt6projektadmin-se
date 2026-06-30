import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";

export const PDF_IMAGE_MAX_EDGE = 1400;
export const PDF_IMAGE_JPEG_QUALITY = 72;

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
 */
export function prepareImageForPdf(bytes: Uint8Array): Uint8Array {
  try {
    const decoded = isJpeg(bytes)
      ? jpeg.decode(bytes, {
          useTArray: true,
          tolerantDecoding: true,
          maxMemoryUsageInMB: 768,
        })
      : isPng(bytes)
        ? PNG.sync.read(Buffer.from(bytes))
        : null;
    if (!decoded) return bytes;
    const longest = Math.max(decoded.width, decoded.height);
    const scale = Math.min(1, PDF_IMAGE_MAX_EDGE / longest);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const data =
      scale < 1
        ? downscaleRgbaNearest(decoded.data, decoded.width, decoded.height, width, height)
        : decoded.data;
    const flattened = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const src = i * 4;
      const alpha = (data[src + 3] ?? 255) / 255;
      flattened[src] = Math.round((data[src] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 1] = Math.round((data[src + 1] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 2] = Math.round((data[src + 2] ?? 255) * alpha + 255 * (1 - alpha));
      flattened[src + 3] = 255;
    }
    const encoded = jpeg.encode({ data: flattened, width, height }, PDF_IMAGE_JPEG_QUALITY);
    // Node Buffer shares an underlying ArrayBuffer pool, so pdf-lib's DataView
    // reads from the wrong offset ("SOI not found in JPEG"). Copy out.
    return new Uint8Array(encoded.data);
  } catch {
    return bytes;
  }
}
