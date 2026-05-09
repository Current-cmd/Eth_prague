# Graph Report - .  (2026-05-09)

## Corpus Check
- 106 files · ~81,256 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 415 nodes · 718 edges · 34 communities (25 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 28,647 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI Components|Frontend UI Components]]
- [[_COMMUNITY_Submit Flow & ZK Primitives|Submit Flow & ZK Primitives]]
- [[_COMMUNITY_Backend Core Services|Backend Core Services]]
- [[_COMMUNITY_Forge Std Testing VM|Forge Std Testing VM]]
- [[_COMMUNITY_IPFS & ENS Services|IPFS & ENS Services]]
- [[_COMMUNITY_Forge Std Cheatcode Printer|Forge Std Cheatcode Printer]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_ZK Proof Computation|ZK Proof Computation]]
- [[_COMMUNITY_File Sanitization|File Sanitization]]
- [[_COMMUNITY_Structured Form Fields|Structured Form Fields]]
- [[_COMMUNITY_Test Fixtures|Test Fixtures]]
- [[_COMMUNITY_Poseidon Contract Generator|Poseidon Contract Generator]]
- [[_COMMUNITY_Shared API Types|Shared API Types]]
- [[_COMMUNITY_ZK Hash Functions|ZK Hash Functions]]
- [[_COMMUNITY_Smart Contract ABIs|Smart Contract ABIs]]
- [[_COMMUNITY_ZK Integration Tests|ZK Integration Tests]]
- [[_COMMUNITY_ENS Live Client|ENS Live Client]]
- [[_COMMUNITY_Blockchain Config|Blockchain Config]]
- [[_COMMUNITY_Shared Enums|Shared Enums]]
- [[_COMMUNITY_Deployment Docs|Deployment Docs]]
- [[_COMMUNITY_ZK Methods Build|ZK Methods Build]]
- [[_COMMUNITY_Demo Root Computation|Demo Root Computation]]
- [[_COMMUNITY_Vite Environment Types|Vite Environment Types]]
- [[_COMMUNITY_Workspace Config|Workspace Config]]

## God Nodes (most connected - your core abstractions)
1. `CheatcodesPrinter` - 29 edges
2. `from_dict()` - 14 edges
3. `dbHelpers` - 10 edges
4. `main()` - 9 edges
5. `namehash()` - 9 edges
6. `leafHash()` - 8 edges
7. `buildTree()` - 8 edges
8. `innerHash()` - 7 edges
9. `main()` - 6 edges
10. `getText()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ZK Build Infrastructure` --semantically_similar_to--> `ZK Circuit Design`  [INFERRED] [semantically similar]
  STOP_POINT.md → README.md
- `Repo README` --semantically_similar_to--> `ShieldPass Project`  [INFERRED] [semantically similar]
  repo/README.md → README.md
- `Deployed Contracts` --semantically_similar_to--> `Sepolia Deployment State`  [INFERRED] [semantically similar]
  README.md → STOP_POINT.md
- `Off-chain Merkle Tree Building` --references--> `ZK Circuit Design`  [INFERRED]
  STOP_POINT.md → README.md
- `main()` --calls--> `nullifier_hash()`  [EXTRACTED]
  repo/packages/zk/host/src/main.rs → packages/zk/methods/guest/src/main.rs

## Hyperedges (group relationships)
- **ShieldPass Submission Flow** — frontend_submit_flow, api_proofs_endpoint, readme_zk_circuit, report_registry_contract, badge_tree_manager_contract [EXTRACTED 0.90]
- **Merkle Proof System** — badge_tree_manager_contract, readme_zk_circuit, poseidont3_library, stop_point_offchain_tree, witness_vector [INFERRED 0.85]
- **ENS Identity Layer** — shieldpass_resolver_contract, company_registry_contract, stop_point_demo_state, phase_final_locked_decisions [EXTRACTED 0.90]
- **Agent Coordination Structure** — phase_final_agent_a, phase_final_agent_b, phase_final_agent_c, frontend_merge_strategy, phase_final_data_models [EXTRACTED 0.95]

## Communities (34 total, 9 thin omitted)

### Community 0 - "Frontend UI Components"
Cohesion: 0.05
Nodes (37): ConnectButton(), EnsName(), EnsNameProps, ProofStatus(), ProofStatusProps, AnonMark(), AnonMarkProps, BadgeProps (+29 more)

### Community 1 - "Submit Flow & ZK Primitives"
Cohesion: 0.06
Nodes (35): BadgeBundle, BadgePicker(), BadgePickerProps, validateInTree(), COMPANY_LEAVES, CompanyLeaves, DEMO_WORKERS, DemoWorker (+27 more)

### Community 2 - "Backend Core Services"
Cohesion: 0.1
Nodes (31): contextPackRoute(), PaymentChallenge, PaymentRequirements, pseudonymsRoute(), reqs(), Job, proofsRoute(), ReqBody (+23 more)

### Community 3 - "Forge Std Testing VM"
Cohesion: 0.07
Nodes (24): PyEnum, Cheatcode, Cheatcodes, cmp_cheatcode(), CmpCheatcode, default(), Enum, EnumVariant (+16 more)

### Community 4 - "IPFS & ENS Services"
Cohesion: 0.14
Nodes (24): companiesRoute(), Company, ipfsRoute(), PinResult, cache, client, ENS_REGISTRY_ABI, ensNodeFromName() (+16 more)

### Community 6 - "Project Documentation"
Cohesion: 0.08
Nodes (29): POST /reports/{reportHash}/contextPack API, POST /proofs API, GET /reports API, BadgeTreeManager Contract, CompanyRegistry Contract, Core Contracts Implementation Plan, Forge Standard Library, Frontend HTML Entry (+21 more)

### Community 7 - "ZK Proof Computation"
Cohesion: 0.13
Nodes (12): Args, bytes_to_hex(), inner_hash(), JournalOutput, leaf_hash(), main(), nullifier_hash(), parse_hex() (+4 more)

### Community 8 - "File Sanitization"
Cohesion: 0.26
Nodes (8): Hex32, sanitizeImage(), sha256OfBlob(), file, jpegBytes, Hex32, sanitizePdf(), file

### Community 9 - "Structured Form Fields"
Cohesion: 0.28
Nodes (6): StructuredFields(), StructuredFieldsProps, CATEGORY_FIELDS, Field, FieldKind, SHARED_TAIL

### Community 10 - "Test Fixtures"
Cohesion: 0.43
Nodes (6): mockApiEndpoints, mockBackendData, mockCompany, mockProofJobStates, mockProofReceipt, mockReports

### Community 11 - "Poseidon Contract Generator"
Cohesion: 0.29
Nodes (6): bytecodeT3, bytecodeT4, fs, outPath, path, { poseidonContract }

### Community 12 - "Shared API Types"
Cohesion: 0.48
Nodes (5): components, $defs, operations, paths, webhooks

### Community 13 - "ZK Hash Functions"
Cohesion: 0.67
Nodes (4): inner_hash(), leaf_hash(), nullifier_hash(), verify_merkle_path()

### Community 14 - "Smart Contract ABIs"
Cohesion: 0.4
Nodes (4): BadgeTreeManagerAbi, CompanyRegistryAbi, ReportRegistryAbi, ShieldPassResolverAbi

### Community 19 - "Deployment Docs"
Cohesion: 0.5
Nodes (4): Locked Decisions, Deployed Contracts, Demo State, Sepolia Deployment State

## Knowledge Gaps
- **82 isolated node(s):** `TABS`, `queryClient`, `ImportMetaEnv`, `ImportMeta`, `StructuredFieldsProps` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CheatcodesPrinter` connect `Forge Std Cheatcode Printer` to `Forge Std Testing VM`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `main()` connect `Forge Std Cheatcode Printer` to `Poseidon Contract Generator`, `Forge Std Testing VM`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `path` connect `Poseidon Contract Generator` to `Forge Std Cheatcode Printer`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `TABS`, `queryClient`, `ImportMetaEnv` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Submit Flow & ZK Primitives` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Backend Core Services` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._