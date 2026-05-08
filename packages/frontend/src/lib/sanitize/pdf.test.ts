import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { sanitizePdf } from "./pdf";

describe("sanitizePdf", () => {
  it("strips Title/Author/Subject/Keywords/Producer/Creator", async () => {
    const original = await PDFDocument.create();
    original.setTitle("SECRET TITLE");
    original.setAuthor("Alice <a@example.com>");
    original.setSubject("internal");
    original.setKeywords(["confidential"]);
    original.setProducer("Acrobat 2024");
    original.setCreator("Word for Mac 2024");
    original.addPage([300, 400]);
    const bytes = await original.save();
    const file = new File([bytes], "test.pdf", { type: "application/pdf" });

    const { blob, sha256 } = await sanitizePdf(file);
    expect(blob.type).toBe("application/pdf");
    expect(sha256).toMatch(/^0x[0-9a-f]{64}$/);

    const sanitized = await PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false });
    expect(sanitized.getTitle()).toBe("");
    expect(sanitized.getAuthor()).toBe("");
    expect(sanitized.getSubject()).toBe("");
    expect(sanitized.getKeywords()).toBe("");
    expect(sanitized.getProducer()).toBe("");
    expect(sanitized.getCreator()).toBe("");
  });
});
