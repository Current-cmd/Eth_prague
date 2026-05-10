<!-- generated from packages/frontend/src/lib/flowchart/graphData.ts — edit that file, not this one -->

# ShieldPass System Flowchart

```mermaid
flowchart TD
  subgraph actor["Actor"]
    WORKER["Worker (Employee)"]:::actor
    ADMIN_USER["Company Admin"]:::actor
    VIEWER["Report Viewer"]:::actor
  end
  subgraph frontend["Frontend"]
    FE_ONBOARDING["Onboarding Page"]:::frontend
    FE_BADGE_PICKER["BadgePicker"]:::frontend
    FE_SUBMIT["Submit Page"]:::frontend
    FE_EXIF_SANITIZE["sanitizeImage (EXIF strip)"]:::frontend
    FE_PDF_SANITIZE["sanitizePdf (metadata strip)"]:::frontend
    FE_MERKLE["buildTree / buildPath"]:::frontend
    FE_COMPANY_ADMIN["CompanyAdmin Page"]:::frontend
    FE_REPORT_DETAIL["ReportDetail Page"]:::frontend
  end
  subgraph backend["Backend"]
    BE_OTP_REQUEST["POST /v1/auth/otp/request"]:::backend
    BE_OTP_VERIFY["POST /v1/auth/otp/verify"]:::backend
    BE_IPFS_PIN["POST /v1/ipfs/pin"]:::backend
    BE_IPFS_PIN_JSON["POST /v1/ipfs/pin-json"]:::backend
    BE_PROOFS_SUBMIT["POST /v1/proofs"]:::backend
    BE_PROOFS_POLL["GET /v1/proofs/:requestId"]:::backend
    BE_REPORTS_LIST["GET /v1/reports"]:::backend
    BE_REPORTS_DETAIL["GET /v1/reports/:reportHash"]:::backend
    BE_BADGES_REGISTER["POST /v1/badges/register"]:::backend
    BE_PROVER["proverClient (RISC Zero)"]:::backend
    BE_INDEXER["startIndexer"]:::backend
    BE_COMPANIES["GET /v1/companies"]:::backend
    BE_CONTEXT_PACK["POST /reports/:id/contextPack"]:::backend
  end
  subgraph db["Db"]
    DB_SQLITE["SQLite (better-sqlite3)"]:::db
  end
  subgraph contracts["Contracts"]
    CT_ONBOARDING["ShieldPassOnboarding"]:::contracts
    CT_REPORT_REGISTRY["ReportRegistry"]:::contracts
    CT_COMPANY_REGISTRY["CompanyRegistry"]:::contracts
    CT_BADGE_TREE_MANAGER["BadgeTreeManager"]:::contracts
    CT_RESOLVER["ShieldPassResolver"]:::contracts
    CT_ENS_REGISTRY["ENS Registry (Sepolia)"]:::contracts
  end
  subgraph external["External"]
    EXT_PINATA["Pinata (IPFS)"]:::external
    EXT_SEPOLIA["Sepolia RPC"]:::external
    EXT_KMS["Orbitport Space KMS"]:::external
    EXT_GMAIL["Gmail SMTP"]:::external
  end

  WORKER -->|"navigates to"| FE_ONBOARDING
  FE_ONBOARDING -->|"POST /v1/auth/otp/request"| BE_OTP_REQUEST
  BE_OTP_REQUEST -->|"INSERT email_otps"| DB_SQLITE
  BE_OTP_REQUEST -->|"sendMail (nodemailer)"| EXT_GMAIL
  FE_ONBOARDING -->|"POST /v1/auth/otp/verify"| BE_OTP_VERIFY
  BE_OTP_VERIFY -->|"UPDATE email_otps SET used=1"| DB_SQLITE
  FE_ONBOARDING -->|"claimBadge(proof, domainHash, nullifier)"| CT_ONBOARDING
  FE_ONBOARDING -->|"POST /v1/badges/register"| BE_BADGES_REGISTER %% stub
  BE_BADGES_REGISTER -->|"sdk.kms.createKey"| EXT_KMS %% stub
  WORKER -->|"navigates to"| FE_SUBMIT
  FE_SUBMIT -->|"renders"| FE_BADGE_PICKER
  FE_BADGE_PICKER -->|"validateInTree / buildPath"| FE_MERKLE
  FE_SUBMIT -->|"sanitizeImage"| FE_EXIF_SANITIZE
  FE_SUBMIT -->|"sanitizePdf"| FE_PDF_SANITIZE
  FE_EXIF_SANITIZE -->|"POST /v1/ipfs/pin"| BE_IPFS_PIN
  FE_PDF_SANITIZE -->|"POST /v1/ipfs/pin"| BE_IPFS_PIN
  BE_IPFS_PIN -->|"pinFileToIPFS"| EXT_PINATA
  FE_SUBMIT -->|"POST /v1/ipfs/pin-json"| BE_IPFS_PIN_JSON
  BE_IPFS_PIN_JSON -->|"pinJSONToIPFS"| EXT_PINATA
  FE_SUBMIT -->|"POST /v1/proofs"| BE_PROOFS_SUBMIT
  BE_PROOFS_SUBMIT -->|"insertProofJob"| DB_SQLITE
  BE_PROOFS_SUBMIT -->|"prover.submit"| BE_PROVER
  BE_PROVER -->|"updateProofJob (fulfilled)"| DB_SQLITE
  FE_SUBMIT -->|"GET /v1/proofs/:requestId"| BE_PROOFS_POLL
  BE_PROOFS_POLL -->|"getProofJob"| DB_SQLITE
  FE_SUBMIT -->|"submitReport(..., cid)"| CT_REPORT_REGISTRY
  CT_REPORT_REGISTRY -->|"isRootFresh(ensNode, root)"| CT_BADGE_TREE_MANAGER
  BE_INDEXER -->|"watchContractEvent ReportSubmitted"| EXT_SEPOLIA
  EXT_SEPOLIA -->|"ReportSubmitted event"| BE_INDEXER
  BE_INDEXER -->|"insertReport"| DB_SQLITE
  EXT_SEPOLIA -->|"RootRotated event"| BE_INDEXER
  BE_INDEXER -->|"insertRootHistory"| DB_SQLITE
  ADMIN_USER -->|"navigates to"| FE_COMPANY_ADMIN
  FE_COMPANY_ADMIN -->|"adminOf(ensNode)"| CT_COMPANY_REGISTRY
  FE_COMPANY_ADMIN -->|"rotateRoot(ensNode, newRoot)"| CT_BADGE_TREE_MANAGER
  FE_COMPANY_ADMIN -->|"setText badge-tree-root"| CT_RESOLVER
  VIEWER -->|"navigates to"| FE_REPORT_DETAIL
  FE_REPORT_DETAIL -->|"GET /v1/reports"| BE_REPORTS_LIST
  BE_REPORTS_LIST -->|"listReports"| DB_SQLITE
  FE_REPORT_DETAIL -->|"GET /v1/reports/:reportHash"| BE_REPORTS_DETAIL
  BE_REPORTS_DETAIL -->|"getReport"| DB_SQLITE
  BE_COMPANIES -->|"getText (ensReader)"| EXT_SEPOLIA
  EXT_SEPOLIA -->|"resolver(node)"| CT_ENS_REGISTRY
  CT_ENS_REGISTRY -->|"resolve(name, data)"| CT_RESOLVER

  classDef actor fill:#e2e8f0,stroke:#1e293b,color:#0f172a,rx:4
  classDef frontend fill:#3b82f6,stroke:#1e293b,color:#0f172a,rx:4
  classDef backend fill:#6b7280,stroke:#1e293b,color:#0f172a,rx:4
  classDef db fill:#8b5cf6,stroke:#1e293b,color:#0f172a,rx:4
  classDef contracts fill:#f97316,stroke:#1e293b,color:#0f172a,rx:4
  classDef external fill:#22c55e,stroke:#1e293b,color:#0f172a,rx:4
```
