// Downscale a picked photo before uploading it.
//
// Phone cameras produce 4000px, multi-megabyte files; the gallery shows at most ~1600px
// and a card thumbnail is ~300px. Shrinking in the browser keeps uploads fast and avoids
// needing a native image library on the server.
const MAX_EDGE = 1600;
const QUALITY = 0.85;

export async function downscaleImage(file, maxEdge = MAX_EDGE) {
  if (!file?.type?.startsWith("image/")) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Older browsers, or a format the decoder refuses: upload the original untouched.
    return file;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= maxEdge) {
    bitmap.close?.();
    return file;
  }

  const scale = maxEdge / longest;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // Re-encoding a PNG losslessly can grow it, so only JPEG output is worth keeping.
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
  if (!blob || blob.size >= file.size) return file; // never upload something larger

  return new File([blob], file.name, { type: blob.type });
}
