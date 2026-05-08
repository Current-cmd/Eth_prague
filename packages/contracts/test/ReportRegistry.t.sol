// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CompanyRegistry}  from "../src/CompanyRegistry.sol";
import {BadgeTreeManager} from "../src/BadgeTreeManager.sol";
import {ReportRegistry}   from "../src/ReportRegistry.sol";
import {MockVerifier}     from "./MockVerifier.sol";
import {IReportRegistry}  from "../src/interfaces/IReportRegistry.sol";

contract ReportRegistryTest is Test {
    CompanyRegistry  cr;
    BadgeTreeManager btm;
    ReportRegistry   rr;
    MockVerifier     mv;

    bytes32 constant NODE     = keccak256("acme.shieldpass-demo.eth");
    address constant ADMIN    = address(0xA11CE);
    bytes32 constant IMAGE_ID = bytes32(uint256(0xBEEF));

    // Fixed witness vector
    bytes32 constant W_ROOT        = bytes32(uint256(1));
    bytes32 constant W_REPORT_HASH = bytes32(uint256(2));
    bytes32 constant W_NULLIFIER   = bytes32(uint256(3));
    uint64  constant W_PERIOD_ID   = 1;
    bytes32 constant W_ENS_NODE    = bytes32(uint256(4));

    // Computed: sha256(abi.encode(root, reportHash, nullifier, periodId, ensNode))
    bytes32 constant EXPECTED_DIGEST = 0x7d5b3fa5e895ef685bc67dda9a028529a5a672ed642bc8f86b72069faf984757;

    function setUp() public {
        cr  = new CompanyRegistry();
        btm = new BadgeTreeManager(address(cr));
        mv  = new MockVerifier();
        rr  = new ReportRegistry(address(mv), IMAGE_ID, address(btm));
        // Register W_ENS_NODE (used in submit calls) and rotate W_ROOT for it
        cr.register(W_ENS_NODE, ADMIN);
        vm.prank(ADMIN);
        btm.rotateRoot(W_ENS_NODE, W_ROOT);
    }

    function test_journal_digest_fixed_vector() public pure {
        bytes32 got = sha256(abi.encode(W_ROOT, W_REPORT_HASH, W_NULLIFIER, W_PERIOD_ID, W_ENS_NODE));
        assertEq(got, EXPECTED_DIGEST, "journalDigest mismatch: field order changed");
    }

    function test_submitReport_happy_path() public {
        vm.expectEmit(true, true, false, true);
        emit IReportRegistry.ReportSubmitted(
            W_ENS_NODE, W_REPORT_HASH, W_NULLIFIER, W_ROOT,
            0, bytes32(uint256(0xDEAD)), "ipfs://test"
        );
        rr.submitReport(
            bytes(""), W_ROOT, W_REPORT_HASH, W_NULLIFIER,
            W_PERIOD_ID, W_ENS_NODE, 0, bytes32(uint256(0xDEAD)), "ipfs://test"
        );
        assertTrue(rr.isNullifierUsed(W_NULLIFIER));
    }

    function test_nullifier_replay_reverts() public {
        rr.submitReport(bytes(""), W_ROOT, W_REPORT_HASH, W_NULLIFIER,
            W_PERIOD_ID, W_ENS_NODE, 0, bytes32(uint256(1)), "ipfs://a");
        vm.expectRevert(bytes("NULLIFIER_USED"));
        rr.submitReport(bytes(""), W_ROOT, W_REPORT_HASH, W_NULLIFIER,
            W_PERIOD_ID, W_ENS_NODE, 0, bytes32(uint256(1)), "ipfs://b");
    }

    function test_stale_root_reverts() public {
        bytes32 staleRoot = bytes32(uint256(0xDEAD));
        vm.expectRevert(bytes("STALE_ROOT"));
        rr.submitReport(bytes(""), staleRoot, W_REPORT_HASH, W_NULLIFIER,
            W_PERIOD_ID, W_ENS_NODE, 0, bytes32(uint256(1)), "ipfs://x");
    }
}
