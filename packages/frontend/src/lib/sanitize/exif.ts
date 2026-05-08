type Hex32 = `0x${string}`;

export async function sha256OfBlob(blob: Blob): Promise<Hex32> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return ("0x" + hex) as Hex32;
}

export async function sanitizeImage(file: File): Promise<{ blob: Blob; sha256: Hex32 }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type}. Convert to JPEG/PNG/WebP first.`);
  }
  const bmp = await createImageBitmap(file);
  let blob: Blob;

  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
    ctx.drawImage(bmp, 0, 0);
    blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bmp, 0, 0);
    blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92),
    );
  }

  bmp.close();
  return { blob, sha256: await sha256OfBlob(blob) };
}
