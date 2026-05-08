import { describe, it, expect, beforeAll } from "vitest";
import { computeReportHash } from "../src/services/ipfs.js";
import { namehash } from "../src/services/ensReader.js";

describe("Backend Services", () => {
  describe("namehash", () => {
    it("should compute ENS namehash correctly", () => {
      // Test case from ENS spec
      const result = namehash("eth");
      expect(result).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae");
    });

    it("should handle empty string", () => {
      const result = namehash("");
      expect(result).toBe("0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("should compute subdomain namehash", () => {
      const result = namehash("acme.shieldpass-demo.eth");
      expect(result).toMatch(/^0x[a-f0-9]{64}$/);
      expect(result).not.toBe("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });

  describe("computeReportHash", () => {
    it("should compute deterministic report hash", () => {
      const ensNode = "0x" + "12".repeat(32) as `0x${string}`;
      const category = 2; // Misclassification
      const payload = {
        version: 1,
        company: { ensName: "acme.shieldpass-demo.eth", ensNode },
        category: "Misclassification",
        title: "Test Report",
        summary: "Test summary",
        structuredFields: {},
        evidence: [],
        submittedAt: "2024-01-01T00:00:00Z",
        pseudonym: "worker-test.workers.acme.shieldpass-demo.eth",
      } as const;

      const hash1 = computeReportHash(ensNode, category, payload as any);
      const hash2 = computeReportHash(ensNode, category, payload as any);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });
});
