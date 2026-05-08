// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {CompanyRegistry}   from "../src/CompanyRegistry.sol";
import {BadgeTreeManager}  from "../src/BadgeTreeManager.sol";
import {ReportRegistry}    from "../src/ReportRegistry.sol";
import {ShieldPassResolver}from "../src/ShieldPassResolver.sol";

contract Deploy is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(key);

        CompanyRegistry cr    = new CompanyRegistry();
        BadgeTreeManager btm  = new BadgeTreeManager(address(cr));
        ReportRegistry rr     = new ReportRegistry(
            vm.envAddress("RISC0_VERIFIER"),
            bytes32(vm.envUint("IMAGE_ID")),
            address(btm)
        );
        ShieldPassResolver res = new ShieldPassResolver(address(cr));

        vm.stopBroadcast();

        console2.log("COMPANY_REGISTRY=%s",    address(cr));
        console2.log("BADGE_TREE_MANAGER=%s",  address(btm));
        console2.log("REPORT_REGISTRY=%s",     address(rr));
        console2.log("SHIELDPASS_RESOLVER=%s", address(res));
    }
}
