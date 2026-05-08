import type { components } from "@shieldpass/shared/api";

// Mock company
export const mockCompany: components["schemas"]["Company"] = {
  ensName: "acme.shieldpass-demo.eth",
  ensNode: "0x" + "12".repeat(32),
  admin: "0x" + "ab".repeat(20),
  active: true,
  badgeTreeRoot: "0x" + "34".repeat(32),
  rootHistory: ["0x" + "34".repeat(32)],
  registeredAt: 1704067200, // 2024-01-01
};

// Mock reports
export const mockReports: components["schemas"]["Report"][] = [
  {
    reportHash: "0x" + "a1".repeat(32),
    ensNode: mockCompany.ensNode,
    nullifier: "0x" + "b2".repeat(32),
    rootUsed: mockCompany.badgeTreeRoot,
    cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    category: "Misclassification",
    submittedAt: 1704067200,
    pseudonymNode: "0x" + "c3".repeat(32),
    txHash: "0x" + "d4".repeat(32),
    blockNumber: 12345,
    contextPackCid: null,
    payload: {
      version: 1,
      company: {
        ensName: mockCompany.ensName,
        ensNode: mockCompany.ensNode,
      },
      category: "Misclassification",
      title: "False Sustainability Claims in Q3 Report",
      summary: "Company claimed carbon neutrality while operating coal-fired plants",
      structuredFields: {
        claim: "Achieved net-zero carbon emissions in Q3 2024",
        reality: "Continued operating 3 coal plants emitting 50k tons CO2e",
        evidenceRefs: ["ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/q3-internal.pdf"],
        publicSourceRefs: ["https://acme.com/sustainability-2024.pdf"],
        incidentDate: "2024-09-01",
        severity: "high",
      },
      evidence: [
        {
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          filename: "q3-internal.pdf",
          mime: "application/pdf",
          sha256: "0x" + "e5".repeat(32),
          sanitized: { tool: "pdf-lib+qpdf", version: "1.0.0" },
        },
      ],
      submittedAt: "2024-01-01T00:00:00Z",
      pseudonym: "worker-7f3a.workers.acme.shieldpass-demo.eth",
    },
  },
  {
    reportHash: "0x" + "a2".repeat(32),
    ensNode: mockCompany.ensNode,
    nullifier: "0x" + "b3".repeat(32),
    rootUsed: mockCompany.badgeTreeRoot,
    cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd2",
    category: "HollowPromise",
    submittedAt: 1704153600,
    pseudonymNode: "0x" + "c4".repeat(32),
    txHash: "0x" + "d5".repeat(32),
    blockNumber: 12352,
    contextPackCid: null,
    payload: {
      version: 1,
      company: {
        ensName: mockCompany.ensName,
        ensNode: mockCompany.ensNode,
      },
      category: "HollowPromise",
      title: "Unfulfilled Remote Work Promise",
      summary: "Hired with promise of remote work, forced into office after 3 months",
      structuredFields: {
        claim: "Flexible remote-first work environment",
        reality: "Mandatory 5 days in office starting month 4",
        evidenceRefs: [],
        publicSourceRefs: ["https://acme.com/careers"],
        incidentDate: "2024-08-15",
        severity: "medium",
      },
      evidence: [],
      submittedAt: "2024-01-02T00:00:00Z",
      pseudonym: "worker-c12d.workers.acme.shieldpass-demo.eth",
    },
  },
  {
    reportHash: "0x" + "a3".repeat(32),
    ensNode: mockCompany.ensNode,
    nullifier: "0x" + "b4".repeat(32),
    rootUsed: mockCompany.badgeTreeRoot,
    cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd3",
    category: "MisleadingPresentation",
    submittedAt: 1704240000,
    pseudonymNode: "0x" + "c5".repeat(32),
    txHash: "0x" + "d6".repeat(32),
    blockNumber: 12360,
    contextPackCid: null,
    payload: {
      version: 1,
      company: {
        ensName: mockCompany.ensName,
        ensNode: mockCompany.ensNode,
      },
      category: "MisleadingPresentation",
      title: "Stock Option Deception",
      summary: "Presented 0.05% equity stake as 'generous equity package' with misleading valuation projections",
      structuredFields: {
        claim: "Competitive equity with 10x growth potential",
        reality: "0.05% stake at current valuation, no growth projections provided",
        evidenceRefs: [],
        publicSourceRefs: [],
        incidentDate: "2024-07-20",
        severity: "high",
      },
      evidence: [],
      submittedAt: "2024-01-03T00:00:00Z",
      pseudonym: "worker-e8f9.workers.acme.shieldpass-demo.eth",
    },
  },
];

// Mock proof receipt
export const mockProofReceipt: components["schemas"]["ProofReceipt"] = {
  seal: "0x" + "f1".repeat(512),
  imageId: "0x" + "aa".repeat(32),
  journal: {
    root: mockCompany.badgeTreeRoot,
    reportHash: mockReports[0].reportHash,
    nullifier: mockReports[0].nullifier,
    periodId: 8738, // ~2024-01-01 / 7776000
    ensNode: mockCompany.ensNode,
  },
};

// Mock proof job states
export const mockProofJobStates: Record<
  string,
  components["schemas"]["ProofJob"]
> = {
  queued: {
    requestId: "queued-uuid",
    status: "queued",
    expiresAt: Math.floor(Date.now() / 1000) + 900,
  },
  fulfilled: {
    requestId: "fulfilled-uuid",
    status: "fulfilled",
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    receipt: mockProofReceipt,
  },
  failed: {
    requestId: "failed-uuid",
    status: "failed",
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    error: "Proof generation failed: INVALID_MERKLE_PATH",
  },
};

// Export as a mock backend data object for Agent C
export const mockBackendData = {
  companies: [mockCompany],
  reports: mockReports,
  proofReceipts: [mockProofReceipt],
  proofJobs: mockProofJobStates,
};

// Conditionally enable mock mode
export const isMockMode = process.env.MOCK_BACKEND === "1";

// Mock API responses (for use in tests or mock mode)
export const mockApiEndpoints = {
  "/v1/healthz": { ok: true },
  "/v1/companies": { items: [mockCompany], nextCursor: null },
  "/v1/companies/acme.shieldpass-demo.eth": mockCompany,
  "/v1/reports": { items: mockReports, nextCursor: null },
  "/v1/reports/" + mockReports[0].reportHash: mockReports[0],
  "/v1/proofs": mockProofJobStates.queued,
  "/v1/proofs/queued-uuid": mockProofJobStates.queued,
  "/v1/proofs/fulfilled-uuid": mockProofJobStates.fulfilled,
  "/v1/proofs/failed-uuid": mockProofJobStates.failed,
};
