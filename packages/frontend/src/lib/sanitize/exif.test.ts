import { describe, it, expect } from "vitest";
import { sanitizeImage, sha256OfBlob } from "./exif";

// happy-dom doesn't ship createImageBitmap; gate the bitmap test on environment.
const hasImageBitmap = typeof createImageBitmap !== "undefined";

describe.skipIf(!hasImageBitmap)("sanitizeImage", () => {
  it("returns blob + sha256 for a valid JPEG", async () => {
    // 1×1 red JPEG (base64), known-tiny
    const jpegBytes = Uint8Array.from(atob(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ" +
      "EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB" +
      "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAEAAQMBIgACEQEDE" +
      "QH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAg" +
      "MABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVG" +
      "R0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmao6Slpqeoqaqys7S1tr" +
      "e4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v8A" +
      "KKKKACiiigD//Z"
    ), c => c.charCodeAt(0));
    const file = new File([jpegBytes], "test.jpg", { type: "image/jpeg" });

    const result = await sanitizeImage(file);
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.sha256).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("sha256OfBlob", () => {
  it("produces a stable hex string", async () => {
    const a = await sha256OfBlob(new Blob([new Uint8Array([1, 2, 3])]));
    const b = await sha256OfBlob(new Blob([new Uint8Array([1, 2, 3])]));
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
