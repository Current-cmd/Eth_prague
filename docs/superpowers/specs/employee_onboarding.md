# Employee Onboarding (ZK-Email Integration)

This document outlines the changes made to the ShieldPass architecture to support a trustless, "Privacy by Design" employee onboarding flow using ZK-Email.

## The Problem
Previously, the ShieldPass platform relied on a hardcoded set of workers (`demoWorkers.ts`), or required a Company Admin to manually generate cryptographic secrets, build a Merkle tree, and distribute JSON credentials to employees out-of-band. This approach required trust in the administrator and lacked a seamless user experience.

## The Solution
We implemented **Option B: The ZK-Email Flow**. 
In this flow, the Company Admin is completely removed from the badge assignment process. Employees independently prove they own a corporate email address by generating a Zero-Knowledge proof of their email's DKIM signature locally in their browser. 

This guarantees:
1. **No PII On-Chain**: Email addresses are never submitted to the blockchain.
2. **Sybil Resistance**: Each email can only claim one badge.
3. **Decoupled Identity**: The entity proving employment (the smart contract) is decoupled from the entity submitting reports, preserving perfect anonymity.

---

## 1. Smart Contract Additions (The Gatekeeper)

We strictly adhered to the "DO NOT DESTROY" rule. The core Two-Tier Merkle Tree logic and KMS integration remain untouched. Instead, we added a modular gatekeeper layer.

### `ShieldPassOnboarding.sol`
A new standalone contract responsible for verifying ZK-Email proofs.
- **`claimBadge(bytes calldata zkEmailProof, bytes32 domainHash, bytes32 nullifier)`**: The core entry point.
- **Sybil Protection**: Uses a mapping `usedEmailNullifiers` to store a hash of the email, preventing an employee from claiming multiple credentials.
- **Verification**: Calls out to an `IZKEmailVerifier` (mocked for the hackathon demo) to cryptographically verify the DKIM signature.
- **Event Emitting**: Upon successful verification, emits a `BadgeRequested` event. The backend (acting as the SpaceComputer KMS) listens for this event, signs the new Merkle root, and finalizes the update on the `BadgeTreeManager`.
- **Security**: Protected against reentrancy using OpenZeppelin's `ReentrancyGuard`.

### Interfaces & Mocks
- **`IShieldPassResolver.sol`**: Added a clean interface for the existing resolver.
- **`IZKEmailVerifier.sol`**: Added an interface for the ZK verifier.
- **`DeployOnboarding.s.sol`**: Added a Forge script to deploy the Onboarding contract along with a `MockZKEmailVerifier` that returns `true` for demo purposes.

---

## 2. Frontend UI Updates

We built the worker-facing interface to make this flow concrete for the judges.

### `Onboarding.tsx`
A new page located at `/onboarding`.
- **User Inputs**: Prompts the worker for their `Company ENS` (e.g., `acme.shieldpass-demo.eth`) and `Work Email`.
- **Client-Side Proof Generation**: A slick UI state that simulates the browser generating a ZK-SNARK, reinforcing the "Privacy by Design" pitch that emails never touch a server.
- **Contract Integration**: Uses `wagmi`'s `useWriteContract` to submit the mock proof and the hashed nullifier to the `ShieldPassOnboarding` contract.
- **Success State**: Explains to the user that the SpaceComputer KMS is signing the new Merkle root in the background.

### `App.tsx` (Navigation)
- Added the `<Route path="/onboarding" element={<Onboarding />} />`.
- Added a new **"Worker Onboarding"** tab to the main navigation bar so judges can easily access the flow.

---

## Pitch Strategy for Judges
When presenting this feature, highlight the following:
> *"Our onboarding uses ZK-Email to issue the badge. But because our Resolver uses a Two-Tier Merkle Tree (Active vs. All-Time), we can instantly remove a badge from the 'Active' tree if the employee is fired. However, because their badge remains in the 'All-Time' tree, they can still blow the whistle on crimes they witnessed while employed. We have decoupled the ability to prove employment from the company's ability to silence the worker."*
