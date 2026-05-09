// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script}             from "forge-std/Script.sol";
import {console2}           from "forge-std/console2.sol";
import {MockRisc0Verifier}  from "../src/MockRisc0Verifier.sol";
import {ReportRegistry}     from "../src/ReportRegistry.sol";

contract DeployMockRegistry is Script {
    function run() external {
        uint256 key     = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address btm     = vm.envAddress("BADGE_TREE_MANAGER");
        bytes32 imageId = bytes32(vm.envUint("IMAGE_ID"));

        vm.startBroadcast(key);
        MockRisc0Verifier mock = new MockRisc0Verifier();
        ReportRegistry rr      = new ReportRegistry(address(mock), imageId, btm);
        vm.stopBroadcast();

        console2.log("MOCK_RISC0_VERIFIER=%s", address(mock));
        console2.log("REPORT_REGISTRY=%s",     address(rr));
    }
}
