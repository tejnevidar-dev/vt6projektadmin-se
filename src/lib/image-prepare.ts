/**
 * Klientsidig bildförberedelse för egenkontroller.
 *
 * Telefonbilder är ofta HEIC/HEIF eller mycket stora JPEG:er med EXIF-rotation.
 * pdf-lib kan bara bädda in JPEG/PNG, så vi normaliserar redan vid uppladdning:
 * avkoda i webbläsaren → rita på canvas → koda om till en kompakt JPEG.
 *
 * Misslyckas avkodningen (t.ex. HEIC i en webbläsare utan stöd) kastar vi ett
 * tydligt fel så att användaren direkt får veta vilken fil som inte funkar –
 * istället för att felet dyker upp först när PDF:en ska genereras.
 */

export const UPLOAD_MAX_EDGE = 1800;
export const UPLOAD_JPEG_QUALITY = 0.82;

export class ImagePrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepareError";
  }
}

function isProbablyImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i.test(file.name);
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through till <img> som klarar fler format i Safari */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("kunde inte avkodas av webbläsaren"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "bild";
}

/**
 * Returnerar alltid en JPEG-fil (image/jpeg) som servern kan bädda in i PDF.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!isProbablyImage(file)) {
    throw new ImagePrepareError(`"${file.name}" är inte en bildfil.`);
  }

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await decode(file);
  } catch (err) {
    throw new ImagePrepareError(
      `"${file.name}" kunde inte läsas (${(err as Error).message}). Prova att ta om bilden eller spara den som JPEG.`,
    );
  }

  const srcW = "width" in bitmap ? bitmap.width : 0;
  const srcH = "height" in bitmap ? bitmap.height : 0;
  if (!srcW || !srcH) {
    throw new ImagePrepareError(`"${file.name}" gav en tom bild.`);
  }

  const scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImagePrepareError("Canvas stöds inte i den här webbläsaren.");
  // Vit bakgrund så att ev. transparens inte blir svart i JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
  );
  if (!blob) {
    throw new ImagePrepareError(`Kunde inte konvertera "${file.name}" till JPEG.`);
  }

  return new File([blob], `${baseName(file.name)}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
