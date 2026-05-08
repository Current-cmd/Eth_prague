import { PDFDocument, PDFName } from "pdf-lib";
import { sha256OfBlob } from "./exif";

type Hex32 = `0x${string}`;

export async function sanitizePdf(file: File): Promise<{ blob: Blob; sha256: Hex32 }> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });

  doc.setTitle("");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");

  // Catalog-level orphans
  doc.catalog.delete(PDFName.of("Metadata"));
  doc.catalog.delete(PDFName.of("PieceInfo"));
  doc.catalog.delete(PDFName.of("StructTreeRoot"));
  doc.catalog.delete(PDFName.of("MarkInfo"));

  // Page-level orphans
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of("Metadata"));
    page.node.delete(PDFName.of("PieceInfo"));
  }

  const bytes = await doc.save({ useObjectStreams: false });
  // Cast to Uint8Array to satisfy strict BlobPart typing (TS 5.4+ ArrayBufferLike vs ArrayBuffer).
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
  return { blob, sha256: await sha256OfBlob(blob) };
}
