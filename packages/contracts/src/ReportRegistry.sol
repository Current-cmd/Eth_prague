// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IReportRegistry}  from "./interfaces/IReportRegistry.sol";
import {IBadgeTreeManager}from "./interfaces/IBadgeTreeManager.sol";
import {IRiscZeroVerifier}from "./interfaces/IRiscZeroVerifier.sol";

contract ReportRegistry is IReportRegistry {
    IRiscZeroVerifier public immutable verifier;
    bytes32           public immutable imageId;
    IBadgeTreeManager public immutable badges;

    mapping(bytes32 => bool) public override isNullifierUsed;

    constructor(address verifier_, bytes32 imageId_, address badges_) {
        verifier = IRiscZeroVerifier(verifier_);
        imageId  = imageId_;
        badges   = IBadgeTreeManager(badges_);
    }

    function submitReport(
        bytes calldata seal,
        bytes32 root,
        bytes32 reportHash,
        bytes32 nullifier,
        uint64  periodId,
        bytes32 ensNode,
        uint8   category,
        bytes32 pseudonymNode,
        string calldata cid
    ) external {
        require(!isNullifierUsed[nullifier], "NULLIFIER_USED");
        require(badges.isRootFresh(ensNode, root), "STALE_ROOT");

        // CRITICAL: field order must match guest env::commit_slice(JournalSol::abi_encode())
        // Do NOT reorder without coordinating with Agent B
        bytes32 journalDigest = sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode));
        verifier.verify(seal, imageId, journalDigest);

        isNullifierUsed[nullifier] = true;
        emit ReportSubmitted(ensNode, reportHash, nullifier, root, category, pseudonymNode, cid);
    }
}
