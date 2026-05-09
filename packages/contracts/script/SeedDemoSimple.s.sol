// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Same as SeedDemo.s.sol but skips on-chain Poseidon tree building.
// Pass DEMO_ROOT as the pre-computed Merkle root (see packages/zk compute-demo-root binary).

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {CompanyRegistry}   from "../src/CompanyRegistry.sol";
import {BadgeTreeManager}  from "../src/BadgeTreeManager.sol";
import {ShieldPassResolver}from "../src/ShieldPassResolver.sol";

interface IENSRegistry {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external;
    function setResolver(bytes32 node, address resolver) external;
}
interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

contract SeedDemoSimple is Script {
    IENSRegistry    constant ENS_REGISTRY   = IENSRegistry(0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e);
    IPublicResolver constant PUBLIC_RESOLVER = IPublicResolver(0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5);

    bytes32 constant PARENT_NODE = keccak256(abi.encodePacked(
        keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))),
        keccak256("shieldpass-demo")
    ));

    uint256 constant BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 key      = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bytes32 demoRoot = bytes32(vm.envUint("DEMO_ROOT"));

        vm.startBroadcast(key);
        bytes32 acmeNode = _setupENS(deployer);
        _setupCompany(acmeNode, deployer, demoRoot);
        _setupWorkers(acmeNode, deployer);
        vm.stopBroadcast();

        console2.log("SeedDemoSimple complete.");
    }

    function _setupENS(address deployer) internal returns (bytes32 acmeNode) {
        bytes32 acmeLabel   = keccak256("acme");
        bytes32 globexLabel = keccak256("globex");
        ENS_REGISTRY.setSubnodeOwner(PARENT_NODE, acmeLabel,   deployer);
        ENS_REGISTRY.setSubnodeOwner(PARENT_NODE, globexLabel, deployer);

        acmeNode = keccak256(abi.encodePacked(PARENT_NODE, acmeLabel));
        bytes32 globexNode = keccak256(abi.encodePacked(PARENT_NODE, globexLabel));

        ENS_REGISTRY.setResolver(acmeNode,   address(PUBLIC_RESOLVER));
        ENS_REGISTRY.setResolver(globexNode, address(PUBLIC_RESOLVER));

        bytes32 workersLabel    = keccak256("workers");
        bytes32 workersAcmeNode = keccak256(abi.encodePacked(acmeNode, workersLabel));
        ENS_REGISTRY.setSubnodeOwner(acmeNode, workersLabel, deployer);
        ENS_REGISTRY.setResolver(workersAcmeNode, address(vm.envAddress("SHIELDPASS_RESOLVER")));
    }

    function _setupCompany(bytes32 acmeNode, address deployer, bytes32 demoRoot) internal {
        CompanyRegistry  cr  = CompanyRegistry(vm.envAddress("COMPANY_REGISTRY"));
        BadgeTreeManager btm = BadgeTreeManager(vm.envAddress("BADGE_TREE_MANAGER"));

        if (cr.adminOf(acmeNode) == address(0)) {
            cr.register(acmeNode, deployer);
        }

        btm.rotateRoot(acmeNode, demoRoot);
        console2.log("Demo Merkle root set:", vm.toString(demoRoot));

        PUBLIC_RESOLVER.setText(acmeNode, "shieldpass.badge-tree-root",    vm.toString(demoRoot));
        PUBLIC_RESOLVER.setText(acmeNode, "shieldpass.registry",           vm.toString(vm.envAddress("REPORT_REGISTRY")));
        PUBLIC_RESOLVER.setText(acmeNode, "shieldpass.attestation-issuer", vm.toString(deployer));
    }

    function _setupWorkers(bytes32 acmeNode, address deployer) internal {
        ShieldPassResolver res = ShieldPassResolver(vm.envAddress("SHIELDPASS_RESOLVER"));

        bytes32 workersLabel    = keccak256("workers");
        bytes32 workersAcmeNode = keccak256(abi.encodePacked(acmeNode, workersLabel));
        bytes32 worker7f3aNode  = keccak256(abi.encodePacked(workersAcmeNode, keccak256("worker-7f3a")));
        bytes32 workerC12dNode  = keccak256(abi.encodePacked(workersAcmeNode, keccak256("worker-c12d")));

        bytes32 leaf0 = bytes32(uint256(keccak256(abi.encodePacked("badge-", uint256(0)))) % BN254_P);
        bytes32 leaf1 = bytes32(uint256(keccak256(abi.encodePacked("badge-", uint256(1)))) % BN254_P);

        res.setSubText(acmeNode, worker7f3aNode, "shieldpass.zk-credential",    vm.toString(leaf0));
        res.setSubText(acmeNode, worker7f3aNode, "shieldpass.reports-submitted", "0");
        res.setSubText(acmeNode, workerC12dNode, "shieldpass.zk-credential",    vm.toString(leaf1));
        res.setSubText(acmeNode, workerC12dNode, "shieldpass.reports-submitted", "0");
        deployer; // suppress unused warning
    }
}
