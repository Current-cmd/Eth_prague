// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ShieldPassOnboarding} from "../src/ShieldPassOnboarding.sol";
import {IZKEmailVerifier} from "../src/interfaces/IZKEmailVerifier.sol";

// Mock Verifier for deployment demonstration
contract MockZKEmailVerifier is IZKEmailVerifier {
    function verify(bytes calldata /*proof*/, bytes32 /*domainHash*/, bytes32 /*nullifier*/) external pure override returns (bool) {
        return true; // Always return true for demo purposes
    }
}

contract DeployOnboarding is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address resolverAddr = vm.envAddress("SHIELDPASS_RESOLVER");
        
        vm.startBroadcast(key);

        MockZKEmailVerifier verifier = new MockZKEmailVerifier();
        ShieldPassOnboarding onboarding = new ShieldPassOnboarding(address(verifier), resolverAddr);

        vm.stopBroadcast();

        console2.log("MOCK_ZK_EMAIL_VERIFIER=%s", address(verifier));
        console2.log("SHIELDPASS_ONBOARDING=%s", address(onboarding));
    }
}
