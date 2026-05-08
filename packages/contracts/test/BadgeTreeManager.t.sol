// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CompanyRegistry} from "../src/CompanyRegistry.sol";
import {BadgeTreeManager} from "../src/BadgeTreeManager.sol";
import {IBadgeTreeManager} from "../src/interfaces/IBadgeTreeManager.sol";

contract BadgeTreeManagerTest is Test {
    CompanyRegistry cr;
    BadgeTreeManager btm;

    bytes32 constant NODE = keccak256("acme.shieldpass-demo.eth");
    address constant ADMIN = address(0xA11CE);

    function setUp() public {
        cr  = new CompanyRegistry();
        btm = new BadgeTreeManager(address(cr));
        cr.register(NODE, ADMIN);
    }

    // Zero-slot guard: bytes32(0) should never be fresh before any rotation
    function test_zero_root_not_fresh_before_rotation() public view {
        assertFalse(btm.isRootFresh(NODE, bytes32(0)));
    }

    // Zero-slot guard: even a real root should not be fresh before any rotation
    function test_root_not_fresh_before_rotation() public view {
        assertFalse(btm.isRootFresh(NODE, bytes32(uint256(1))));
    }

    function test_rotateRoot_basic() public {
        bytes32 root = bytes32(uint256(42));
        vm.prank(ADMIN);
        btm.rotateRoot(NODE, root);
        assertTrue(btm.isRootFresh(NODE, root));
    }

    function test_rotateRoot_not_admin_reverts() public {
        vm.expectRevert(bytes("not-admin"));
        btm.rotateRoot(NODE, bytes32(uint256(1)));
    }

    function test_rotateRoot_emits() public {
        bytes32 root = bytes32(uint256(99));
        vm.expectEmit(true, false, false, true);
        emit IBadgeTreeManager.RootRotated(NODE, root, bytes32(0));
        vm.prank(ADMIN);
        btm.rotateRoot(NODE, root);
    }

    // Off-by-one regression: 8 rotations, all 8 roots fresh; 9th evicts root[0]
    function test_freshness_window_8_roots() public {
        bytes32[8] memory roots;
        for (uint256 i = 0; i < 8; i++) {
            roots[i] = bytes32(uint256(i + 1));
            vm.prank(ADMIN);
            btm.rotateRoot(NODE, roots[i]);
        }
        // All 8 still fresh (no time passage)
        for (uint256 i = 0; i < 8; i++) {
            assertTrue(btm.isRootFresh(NODE, roots[i]), "root should be fresh");
        }
        // 9th rotation evicts roots[0] (slot 0 overwritten)
        bytes32 root9 = bytes32(uint256(9));
        vm.prank(ADMIN);
        btm.rotateRoot(NODE, root9);
        assertFalse(btm.isRootFresh(NODE, roots[0]), "root[0] should be evicted");
        assertTrue(btm.isRootFresh(NODE, root9));
    }

    // Time-based freshness: root set >7 days ago is stale
    function test_freshness_expires_after_7_days() public {
        bytes32 root = bytes32(uint256(77));
        vm.prank(ADMIN);
        btm.rotateRoot(NODE, root);
        assertTrue(btm.isRootFresh(NODE, root));

        vm.warp(block.timestamp + 7 days + 1);
        assertFalse(btm.isRootFresh(NODE, root), "should be stale after 7 days");
    }
}
