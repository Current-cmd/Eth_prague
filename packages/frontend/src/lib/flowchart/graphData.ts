export type LayerID = "actor" | "frontend" | "backend" | "db" | "contracts" | "external";

export interface FlowNode {
  id: string;
  label: string;
  layer: LayerID;
  stub?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  flow: FlowID;
}

export type FlowID = "onboarding" | "submit" | "indexer" | "admin" | "viewing" | "ens";

export const LAYER_COLORS: Record<LayerID, string> = {
  actor:     "#e2e8f0",
  frontend:  "#3b82f6",
  backend:   "#6b7280",
  db:        "#8b5cf6",
  contracts: "#f97316",
  external:  "#22c55e",
};

// ─── Nodes ────────────────────────────────────────────────────────────────────

export const NODES: FlowNode[] = [
  // Actors
  { id: "WORKER",            label: "Worker (Employee)",             layer: "actor" },
  { id: "ADMIN_USER",        label: "Company Admin",                 layer: "actor" },
  { id: "VIEWER",            label: "Report Viewer",                 layer: "actor" },

  // Frontend
  { id: "FE_ONBOARDING",    label: "Onboarding Page",               layer: "frontend" },
  { id: "FE_BADGE_PICKER",  label: "BadgePicker",                   layer: "frontend" },
  { id: "FE_SUBMIT",        label: "Submit Page",                   layer: "frontend" },
  { id: "FE_EXIF_SANITIZE", label: "sanitizeImage (EXIF strip)",    layer: "frontend" },
  { id: "FE_PDF_SANITIZE",  label: "sanitizePdf (metadata strip)",  layer: "frontend" },
  { id: "FE_MERKLE",        label: "buildTree / buildPath",         layer: "frontend" },
  { id: "FE_COMPANY_ADMIN", label: "CompanyAdmin Page",             layer: "frontend" },
  { id: "FE_REPORT_DETAIL", label: "ReportDetail Page",             layer: "frontend" },

  // Backend
  { id: "BE_OTP_REQUEST",     label: "POST /v1/auth/otp/request",      layer: "backend" },
  { id: "BE_OTP_VERIFY",      label: "POST /v1/auth/otp/verify",       layer: "backend" },
  { id: "BE_IPFS_PIN",        label: "POST /v1/ipfs/pin",              layer: "backend" },
  { id: "BE_IPFS_PIN_JSON",   label: "POST /v1/ipfs/pin-json",         layer: "backend" },
  { id: "BE_PROOFS_SUBMIT",   label: "POST /v1/proofs",                layer: "backend" },
  { id: "BE_PROOFS_POLL",     label: "GET /v1/proofs/:requestId",      layer: "backend" },
  { id: "BE_REPORTS_LIST",    label: "GET /v1/reports",                layer: "backend" },
  { id: "BE_REPORTS_DETAIL",  label: "GET /v1/reports/:reportHash",    layer: "backend" },
  { id: "BE_BADGES_REGISTER", label: "POST /v1/badges/register",       layer: "backend", stub: true },
  { id: "BE_PROVER",          label: "proverClient (RISC Zero)",        layer: "backend" },
  { id: "BE_INDEXER",         label: "startIndexer",                   layer: "backend" },
  { id: "BE_COMPANIES",       label: "GET /v1/companies",              layer: "backend" },
  { id: "BE_CONTEXT_PACK",    label: "POST /reports/:id/contextPack",  layer: "backend", stub: true },

  // DB
  { id: "DB_SQLITE",   label: "SQLite (better-sqlite3)", layer: "db" },

  // Contracts
  { id: "CT_ONBOARDING",        label: "ShieldPassOnboarding",    layer: "contracts" },
  { id: "CT_REPORT_REGISTRY",   label: "ReportRegistry",          layer: "contracts" },
  { id: "CT_COMPANY_REGISTRY",  label: "CompanyRegistry",         layer: "contracts" },
  { id: "CT_BADGE_TREE_MANAGER",label: "BadgeTreeManager",        layer: "contracts" },
  { id: "CT_RESOLVER",          label: "ShieldPassResolver",      layer: "contracts" },
  { id: "CT_ENS_REGISTRY",      label: "ENS Registry (Sepolia)",  layer: "contracts" },

  // External
  { id: "EXT_PINATA",   label: "Pinata (IPFS)",       layer: "external" },
  { id: "EXT_SEPOLIA",  label: "Sepolia RPC",          layer: "external" },
  { id: "EXT_KMS",      label: "Orbitport Space KMS",  layer: "external" },
  { id: "EXT_GMAIL",    label: "Gmail SMTP",           layer: "external" },
];

// ─── Edges ────────────────────────────────────────────────────────────────────

export const EDGES: FlowEdge[] = [
  // ── onboarding ──────────────────────────────────────────────────────────────
  { id: "e01", source: "WORKER",          target: "FE_ONBOARDING",    label: "navigates to",                         flow: "onboarding" },
  { id: "e02", source: "FE_ONBOARDING",   target: "BE_OTP_REQUEST",   label: "POST /v1/auth/otp/request",            flow: "onboarding" },
  { id: "e03", source: "BE_OTP_REQUEST",  target: "DB_SQLITE",        label: "INSERT email_otps",                    flow: "onboarding" },
  { id: "e04", source: "BE_OTP_REQUEST",  target: "EXT_GMAIL",        label: "sendMail (nodemailer)",                flow: "onboarding" },
  { id: "e05", source: "FE_ONBOARDING",   target: "BE_OTP_VERIFY",    label: "POST /v1/auth/otp/verify",             flow: "onboarding" },
  { id: "e06", source: "BE_OTP_VERIFY",   target: "DB_SQLITE",        label: "UPDATE email_otps SET used=1",         flow: "onboarding" },
  { id: "e07", source: "FE_ONBOARDING",   target: "CT_ONBOARDING",    label: "claimBadge(proof, domainHash, nullifier)", flow: "onboarding" },
  { id: "e08", source: "FE_ONBOARDING",   target: "BE_BADGES_REGISTER", label: "POST /v1/badges/register",           flow: "onboarding" },
  { id: "e09", source: "BE_BADGES_REGISTER", target: "EXT_KMS",       label: "sdk.kms.createKey",                   flow: "onboarding" },

  // ── submit ──────────────────────────────────────────────────────────────────
  { id: "e10", source: "WORKER",           target: "FE_SUBMIT",        label: "navigates to",                        flow: "submit" },
  { id: "e11", source: "FE_SUBMIT",        target: "FE_BADGE_PICKER",  label: "renders",                             flow: "submit" },
  { id: "e12", source: "FE_BADGE_PICKER",  target: "FE_MERKLE",        label: "validateInTree / buildPath",          flow: "submit" },
  { id: "e13", source: "FE_SUBMIT",        target: "FE_EXIF_SANITIZE", label: "sanitizeImage",                       flow: "submit" },
  { id: "e14", source: "FE_SUBMIT",        target: "FE_PDF_SANITIZE",  label: "sanitizePdf",                         flow: "submit" },
  { id: "e15", source: "FE_EXIF_SANITIZE", target: "BE_IPFS_PIN",      label: "POST /v1/ipfs/pin",                   flow: "submit" },
  { id: "e16", source: "FE_PDF_SANITIZE",  target: "BE_IPFS_PIN",      label: "POST /v1/ipfs/pin",                   flow: "submit" },
  { id: "e17", source: "BE_IPFS_PIN",      target: "EXT_PINATA",       label: "pinFileToIPFS",                       flow: "submit" },
  { id: "e18", source: "FE_SUBMIT",        target: "BE_IPFS_PIN_JSON", label: "POST /v1/ipfs/pin-json",              flow: "submit" },
  { id: "e19", source: "BE_IPFS_PIN_JSON", target: "EXT_PINATA",       label: "pinJSONToIPFS",                       flow: "submit" },
  { id: "e20", source: "FE_SUBMIT",        target: "BE_PROOFS_SUBMIT", label: "POST /v1/proofs",                     flow: "submit" },
  { id: "e21", source: "BE_PROOFS_SUBMIT", target: "DB_SQLITE",        label: "insertProofJob",                      flow: "submit" },
  { id: "e22", source: "BE_PROOFS_SUBMIT", target: "BE_PROVER",        label: "prover.submit",                       flow: "submit" },
  { id: "e23", source: "BE_PROVER",        target: "DB_SQLITE",        label: "updateProofJob (fulfilled)",          flow: "submit" },
  { id: "e24", source: "FE_SUBMIT",        target: "BE_PROOFS_POLL",   label: "GET /v1/proofs/:requestId",           flow: "submit" },
  { id: "e25", source: "BE_PROOFS_POLL",   target: "DB_SQLITE",        label: "getProofJob",                         flow: "submit" },
  { id: "e26", source: "FE_SUBMIT",        target: "CT_REPORT_REGISTRY", label: "submitReport(..., cid)",            flow: "submit" },
  { id: "e27", source: "CT_REPORT_REGISTRY", target: "CT_BADGE_TREE_MANAGER", label: "isRootFresh(ensNode, root)",   flow: "submit" },

  // ── indexer ─────────────────────────────────────────────────────────────────
  { id: "e28", source: "BE_INDEXER",  target: "EXT_SEPOLIA", label: "watchContractEvent ReportSubmitted", flow: "indexer" },
  { id: "e29", source: "EXT_SEPOLIA", target: "BE_INDEXER",  label: "ReportSubmitted event",              flow: "indexer" },
  { id: "e30", source: "BE_INDEXER",  target: "DB_SQLITE",   label: "insertReport",                       flow: "indexer" },
  { id: "e31", source: "EXT_SEPOLIA", target: "BE_INDEXER",  label: "RootRotated event",                  flow: "indexer" },
  { id: "e32", source: "BE_INDEXER",  target: "DB_SQLITE",   label: "insertRootHistory",                  flow: "indexer" },

  // ── admin ───────────────────────────────────────────────────────────────────
  { id: "e33", source: "ADMIN_USER",       target: "FE_COMPANY_ADMIN",       label: "navigates to",                   flow: "admin" },
  { id: "e34", source: "FE_COMPANY_ADMIN", target: "CT_COMPANY_REGISTRY",    label: "adminOf(ensNode)",               flow: "admin" },
  { id: "e35", source: "FE_COMPANY_ADMIN", target: "CT_BADGE_TREE_MANAGER",  label: "rotateRoot(ensNode, newRoot)",   flow: "admin" },
  { id: "e36", source: "FE_COMPANY_ADMIN", target: "CT_RESOLVER",            label: "setText badge-tree-root",        flow: "admin" },

  // ── viewing ─────────────────────────────────────────────────────────────────
  { id: "e37", source: "VIEWER",           target: "FE_REPORT_DETAIL",   label: "navigates to",                  flow: "viewing" },
  { id: "e38", source: "FE_REPORT_DETAIL", target: "BE_REPORTS_LIST",    label: "GET /v1/reports",               flow: "viewing" },
  { id: "e39", source: "BE_REPORTS_LIST",  target: "DB_SQLITE",          label: "listReports",                   flow: "viewing" },
  { id: "e40", source: "FE_REPORT_DETAIL", target: "BE_REPORTS_DETAIL",  label: "GET /v1/reports/:reportHash",   flow: "viewing" },
  { id: "e41", source: "BE_REPORTS_DETAIL",target: "DB_SQLITE",          label: "getReport",                     flow: "viewing" },

  // ── ens ─────────────────────────────────────────────────────────────────────
  { id: "e42", source: "BE_COMPANIES",    target: "EXT_SEPOLIA",     label: "getText (ensReader)",    flow: "ens" },
  { id: "e43", source: "EXT_SEPOLIA",     target: "CT_ENS_REGISTRY", label: "resolver(node)",        flow: "ens" },
  { id: "e44", source: "CT_ENS_REGISTRY", target: "CT_RESOLVER",     label: "resolve(name, data)",   flow: "ens" },
];
