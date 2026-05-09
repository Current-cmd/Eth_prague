// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";

contract ShieldPassOnboarding {
    IZKEmailVerifier public immutable verifier;

    // Prevents double-claiming: nullifier -> true if used
    mapping(bytes32 => bool) public usedEmailNullifiers;

    event BadgeRequested(address indexed sender, bytes32 indexed domainHash, bytes32 nullifier);
    event BadgeClaimed(bytes32 indexed domainHash, bytes32 nullifier);

    constructor(address _verifier) {
        verifier = IZKEmailVerifier(_verifier);
    }

    /// @notice Claim a badge by submitting a ZK-Email proof of corporate email ownership.
    /// @dev Check-Effects-Interactions: nullifier is marked BEFORE external verify call.
    function claimBadge(
        bytes calldata zkEmailProof,
        bytes32 domainHash,
        bytes32 nullifier
    ) external {
        // 1. Check
        require(!usedEmailNullifiers[nullifier], "Email already used for a badge");

        // 2. Effect (before external call — prevents re-entrancy)
        usedEmailNullifiers[nullifier] = true;

        // 3. Interact — verify DKIM proof (mock: always true in demo)
        bool isValid = verifier.verify(zkEmailProof, domainHash, nullifier);
        require(isValid, "Invalid ZK-Email Proof");

        emit BadgeRequested(msg.sender, domainHash, nullifier);
        emit BadgeClaimed(domainHash, nullifier);
    }
}
