// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {CompanyRegistry} from "../src/CompanyRegistry.sol";

contract CompanyRegistryTest is Test {
    CompanyRegistry cr;
    bytes32 constant NODE = keccak256("acme.shieldpass-demo.eth");

    function setUp() public {
        cr = new CompanyRegistry();
    }

    function test_register() public {
        cr.register(NODE, address(this));
        assertTrue(cr.isActive(NODE));
        assertEq(cr.adminOf(NODE), address(this));
    }

    function test_register_twice_reverts() public {
        cr.register(NODE, address(this));
        vm.expectRevert(bytes("already-registered"));
        cr.register(NODE, address(0xBEEF));
    }

    function test_unknown_node_is_inactive() public view {
        assertFalse(cr.isActive(keccak256("unknown")));
    }

    function test_emit_on_register() public {
        vm.expectEmit(true, false, false, true);
        emit CompanyRegistry.CompanyRegistered(NODE, address(this));
        cr.register(NODE, address(this));
    }
}
