// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CompanyRegistry}    from "../src/CompanyRegistry.sol";
import {ShieldPassResolver} from "../src/ShieldPassResolver.sol";

contract ShieldPassResolverTest is Test {
    CompanyRegistry    cr;
    ShieldPassResolver resolver;

    // namehash("acme.shieldpass-demo.eth") — standard ENS namehash
    bytes32 constant ACME_NODE = keccak256(abi.encodePacked(
        keccak256(abi.encodePacked(
            keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))),
            keccak256("shieldpass-demo")
        )),
        keccak256("acme")
    ));

    address constant ADMIN = address(0xA11CE);

    function setUp() public {
        cr = new CompanyRegistry();
        resolver = new ShieldPassResolver(address(cr), address(0x42));
        cr.register(ACME_NODE, ADMIN);
    }

    function test_supportsInterface_extended() public view {
        assertTrue(resolver.supportsInterface(0x9061b923));
    }
    function test_supportsInterface_erc165() public view {
        assertTrue(resolver.supportsInterface(0x01ffc9a7));
    }
    function test_supportsInterface_text() public view {
        assertTrue(resolver.supportsInterface(0x59d1d43c));
    }

    // DNS-wire encoding of "worker-7f3a.workers.acme.shieldpass-demo.eth"
    function _workerDnsName() internal pure returns (bytes memory) {
        return abi.encodePacked(
            uint8(11), "worker-7f3a",
            uint8(7),  "workers",
            uint8(4),  "acme",
            uint8(15), "shieldpass-demo",
            uint8(3),  "eth",
            uint8(0)
        );
    }

    // Compute what _parentNode() returns for _workerDnsName():
    // Skip "worker-7f3a" (12+1=13 bytes), then accumulate "workers", "acme", "shieldpass-demo", "eth"
    function _expectedParentNode() internal pure returns (bytes32 node) {
        node = bytes32(0);
        node = keccak256(abi.encodePacked(node, keccak256("workers")));
        node = keccak256(abi.encodePacked(node, keccak256("acme")));
        node = keccak256(abi.encodePacked(node, keccak256("shieldpass-demo")));
        node = keccak256(abi.encodePacked(node, keccak256("eth")));
    }

    // ENS namehash of "worker-7f3a.workers.acme.shieldpass-demo.eth"
    function _workerEnsThenodash() internal pure returns (bytes32) {
        bytes32 n = bytes32(0);
        n = keccak256(abi.encodePacked(n, keccak256("eth")));
        n = keccak256(abi.encodePacked(n, keccak256("shieldpass-demo")));
        n = keccak256(abi.encodePacked(n, keccak256("acme")));
        n = keccak256(abi.encodePacked(n, keccak256("workers")));
        n = keccak256(abi.encodePacked(n, keccak256("worker-7f3a")));
        return n;
    }

    // _parentNode decodes a known DNS-wire input correctly (parentText fallback path)
    function test_parentNode_decodes_and_resolve_fallback() public {
        bytes32 parentNode = _expectedParentNode();
        vm.prank(ADMIN);
        // NOTE: onlyAdmin(parentNode) won't work because parentNode is not registered in cr.
        // Use ACME_NODE (which IS registered) for auth, but parentText is keyed by parentNode.
        // The setText modifier uses the first argument as the auth node.
        // So we need to either:
        //   a) register parentNode in CompanyRegistry, OR
        //   b) call setText with ACME_NODE as auth but that would store under ACME_NODE not parentNode
        // The spec's setText signature: setText(bytes32 parentNode, string key, string value)
        // and onlyAdmin(parentNode) — so we need to register parentNode.
        cr.register(parentNode, ADMIN);
        vm.prank(ADMIN);
        resolver.setText(parentNode, "shieldpass.zk-credential", "commitment-xyz");

        bytes32 workerNode = _workerEnsThenodash();
        bytes memory data = abi.encodeWithSelector(
            bytes4(0x59d1d43c),
            workerNode,
            "shieldpass.zk-credential"
        );
        bytes memory result = resolver.resolve(_workerDnsName(), data);
        string memory val = abi.decode(result, (string));
        assertEq(val, "commitment-xyz");
    }

    // setSubText direct override takes priority
    function test_subText_override_takes_priority() public {
        bytes32 parentNode = _expectedParentNode();
        bytes32 workerNode = _workerEnsThenodash();

        // Register parentNode for auth
        cr.register(parentNode, ADMIN);

        vm.startPrank(ADMIN);
        resolver.setText(parentNode, "shieldpass.zk-credential", "parent-val");
        resolver.setSubText(parentNode, workerNode, "shieldpass.zk-credential", "sub-val");
        vm.stopPrank();

        bytes memory data = abi.encodeWithSelector(
            bytes4(0x59d1d43c), workerNode, "shieldpass.zk-credential"
        );
        bytes memory result = resolver.resolve(_workerDnsName(), data);
        assertEq(abi.decode(result, (string)), "sub-val");
    }

    // Unknown selector returns empty bytes
    function test_resolve_unknown_selector_returns_empty() public view {
        bytes memory data = abi.encodeWithSelector(bytes4(0xDEADBEEF), bytes32(0), "key");
        bytes memory result = resolver.resolve(_workerDnsName(), data);
        assertEq(result.length, 0);
    // -------------------------------------------------------------
    // SpaceComputer KMS & Two-Tier Badge System Tests
    // -------------------------------------------------------------

    function test_kms_initialization() public view {
        assertEq(resolver.spaceComputerKMS(), address(0x42));
        assertEq(resolver.owner(), address(this));
    }

    function test_setActiveBadgeRoot_success() public {
        bytes32 newRoot = keccak256("new-active-root");
        vm.prank(address(0x42));
        resolver.setActiveBadgeRoot(ACME_NODE, newRoot);
        assertEq(resolver.activeBadgeRoot(ACME_NODE), newRoot);
    }

    function test_setActiveBadgeRoot_reverts_notKMS() public {
        bytes32 newRoot = keccak256("new-active-root");
        vm.prank(ADMIN);
        vm.expectRevert("not-kms");
        resolver.setActiveBadgeRoot(ACME_NODE, newRoot);
    }

    function test_setAllTimeBadgeRoot_success() public {
        bytes32 newRoot = keccak256("new-all-time-root");
        vm.prank(address(0x42));
        resolver.setAllTimeBadgeRoot(ACME_NODE, newRoot);
        assertEq(resolver.allTimeBadgeRoot(ACME_NODE), newRoot);
    }

    function test_setAllTimeBadgeRoot_reverts_notKMS() public {
        bytes32 newRoot = keccak256("new-all-time-root");
        vm.prank(ADMIN);
        vm.expectRevert("not-kms");
        resolver.setAllTimeBadgeRoot(ACME_NODE, newRoot);
    }

    function test_kms_rotation_flow() public {
        address newKms = address(0x99);
        
        // 1. Propose new KMS (only owner)
        vm.prank(address(this));
        resolver.proposeKMS(newKms);
        assertEq(resolver.pendingSpaceComputerKMS(), newKms);

        // 2. Accept new KMS (only pending KMS)
        vm.prank(newKms);
        resolver.acceptKMS();
        
        assertEq(resolver.spaceComputerKMS(), newKms);
        assertEq(resolver.pendingSpaceComputerKMS(), address(0));

        // 3. Verify old KMS cannot update roots
        vm.prank(address(0x42));
        vm.expectRevert("not-kms");
        resolver.setActiveBadgeRoot(ACME_NODE, keccak256("test"));

        // 4. Verify new KMS can update roots
        vm.prank(newKms);
        resolver.setActiveBadgeRoot(ACME_NODE, keccak256("test"));
        assertEq(resolver.activeBadgeRoot(ACME_NODE), keccak256("test"));
    }

    function test_proposeKMS_reverts_notOwner() public {
        vm.prank(ADMIN);
        vm.expectRevert("not-owner");
        resolver.proposeKMS(address(0x99));
    }
}
