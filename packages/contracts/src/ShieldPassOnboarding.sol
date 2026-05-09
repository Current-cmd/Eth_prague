// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IShieldPassResolver} from "./interfaces/IShieldPassResolver.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";

contract ShieldPassOnboarding is ReentrancyGuard {
    IZKEmailVerifier public immutable verifier;
    IShieldPassResolver public immutable resolver;

    // Prevents double-claiming: nullifier -> true if used
    mapping(bytes32 => bool) public usedEmailNullifiers;
    
    // DKIM Registry: maps domainHash to company's RSA Public Key
    mapping(bytes32 => bytes) public companyPublicKeys;

    event BadgeRequested(address indexed sender, bytes32 indexed domainHash, bytes32 nullifier);
    event BadgeClaimed(bytes32 indexed domainHash, bytes32 nullifier);
    event CompanyPublicKeySet(bytes32 indexed domainHash, bytes publicKey);

    constructor(address _verifier, address _resolver) {
        verifier = IZKEmailVerifier(_verifier);
        resolver = IShieldPassResolver(_resolver);
    }

    /// @notice Allows setting the company public key (Mock DKIM Registry)
    /// @dev In production this should have strict access control
    function setCompanyPublicKey(bytes32 domainHash, bytes calldata publicKey) external {
        companyPublicKeys[domainHash] = publicKey;
        emit CompanyPublicKeySet(domainHash, publicKey);
    }

    /// @notice Handles the "Identity Proof" so the "Report Registry" stays anonymous.
    function claimBadge(
        bytes calldata zkEmailProof, 
        bytes32 domainHash, 
        bytes32 nullifier
    ) external nonReentrant {
        // 1. Check if this email has already claimed a badge
        require(!usedEmailNullifiers[nullifier], "Email already used for a badge");

        // 2. Verify the ZK-Email Proof (DKIM signature proof)
        // In a real app, this calls the ZK-Email Verifier contract
        bool isValid = verifier.verify(zkEmailProof, domainHash, nullifier);
        require(isValid, "Invalid ZK-Email Proof");

        // 3. Prevent double-claiming
        usedEmailNullifiers[nullifier] = true;

        // 4. Trigger the Resolver update
        // We emit an event so the SpaceComputer KMS knows it's time to sign a new root
        // and finalize the update on-chain for the Resolver.
        emit BadgeRequested(msg.sender, domainHash, nullifier);
        emit BadgeClaimed(domainHash, nullifier);
    }
}
