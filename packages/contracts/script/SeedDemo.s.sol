// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script}            from "forge-std/Script.sol";
import {console2}          from "forge-std/console2.sol";
import {CompanyRegistry}   from "../src/CompanyRegistry.sol";
import {BadgeTreeManager}  from "../src/BadgeTreeManager.sol";
import {ShieldPassResolver}from "../src/ShieldPassResolver.sol";
import {PoseidonT3}        from "../src/libraries/PoseidonT3.sol";

interface IENSRegistry {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external;
    function setResolver(bytes32 node, address resolver) external;
}
interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

contract SeedDemo is Script {
    IENSRegistry    constant ENS_REGISTRY   = IENSRegistry(0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e);
    IPublicResolver constant PUBLIC_RESOLVER = IPublicResolver(0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5);

    // namehash("shieldpass-demo.eth")
    bytes32 constant PARENT_NODE = keccak256(abi.encodePacked(
        keccak256(abi.encodePacked(bytes32(0), keccak256("eth"))),
        keccak256("shieldpass-demo")
    ));

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        uint256 key      = vm.envUint("DEPLOYER_PRIVATE_KEY");

        CompanyRegistry    cr  = CompanyRegistry(vm.envAddress("COMPANY_REGISTRY"));
        BadgeTreeManager   btm = BadgeTreeManager(vm.envAddress("BADGE_TREE_MANAGER"));
        ShieldPassResolver res = ShieldPassResolver(vm.envAddress("SHIELDPASS_RESOLVER"));

        vm.startBroadcast(key);

        (bytes32 acmeNode, bytes32 workersAcmeNode) = _setupENS(deployer, res);
        _registerCompany(cr, acmeNode, deployer);
        bytes32 demoRoot = _buildAndRotateTree(btm, acmeNode);
        _setTextRecords(acmeNode, demoRoot, deployer);
        _setWorkerRecords(res, acmeNode, workersAcmeNode);

        vm.stopBroadcast();
        console2.log("SeedDemo complete.");
    }

    function _setupENS(address deployer, ShieldPassResolver res)
        internal
        returns (bytes32 acmeNode, bytes32 workersAcmeNode)
    {
        bytes32 acmeLabel   = keccak256("acme");
        bytes32 globexLabel = keccak256("globex");
        ENS_REGISTRY.setSubnodeOwner(PARENT_NODE, acmeLabel,   deployer);
        ENS_REGISTRY.setSubnodeOwner(PARENT_NODE, globexLabel, deployer);

        acmeNode = keccak256(abi.encodePacked(PARENT_NODE, acmeLabel));
        bytes32 globexNode = keccak256(abi.encodePacked(PARENT_NODE, globexLabel));

        ENS_REGISTRY.setResolver(acmeNode,   address(PUBLIC_RESOLVER));
        ENS_REGISTRY.setResolver(globexNode, address(PUBLIC_RESOLVER));

        bytes32 workersLabel = keccak256("workers");
        ENS_REGISTRY.setSubnodeOwner(acmeNode, workersLabel, deployer);
        workersAcmeNode = keccak256(abi.encodePacked(acmeNode, workersLabel));
        ENS_REGISTRY.setResolver(workersAcmeNode, address(res));
    }

    function _registerCompany(CompanyRegistry cr, bytes32 acmeNode, address deployer) internal {
        if (cr.adminOf(acmeNode) == address(0)) {
            cr.register(acmeNode, deployer);
        }
    }

    function _buildAndRotateTree(BadgeTreeManager btm, bytes32 acmeNode)
        internal
        returns (bytes32 demoRoot)
    {
        uint256 TREE_SIZE = 1 << 16; // 65536

        uint256 ZERO_LEAF = PoseidonT3.hash2(0, 0);
        uint256[] memory nodes = new uint256[](TREE_SIZE);
        for (uint256 i = 0; i < TREE_SIZE; i++) nodes[i] = ZERO_LEAF;

        uint256 BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        for (uint256 i = 0; i < 8; i++) {
            nodes[i] = PoseidonT3.hash2(0, uint256(keccak256(abi.encodePacked("badge-", i))) % BN254_P);
        }

        uint256 width = TREE_SIZE;
        while (width > 1) {
            width >>= 1;
            for (uint256 i = 0; i < width; i++) {
                nodes[i] = PoseidonT3.hash3(1, nodes[2 * i], nodes[2 * i + 1]);
            }
        }

        demoRoot = bytes32(nodes[0]);
        console2.log("Demo Merkle root:", vm.toString(demoRoot));
        btm.rotateRoot(acmeNode, demoRoot);
    }

    function _setTextRecords(bytes32 acmeNode, bytes32 demoRoot, address deployer) internal {
        PUBLIC_RESOLVER.setText(acmeNode, "shieldpass.badge-tree-root",    vm.toString(demoRoot));
        PUBLIC_RESOLVER.setText(acmeNode, "shieldpass.registry",           vm.toString(vm.envAddress("REPORT_REGISTRY")));
        PUBLIC_RESOLVER.setText(acmeNode, "shieldpass.attestation-issuer", vm.toString(deployer));
    }

    function _setWorkerRecords(
        ShieldPassResolver res,
        bytes32 acmeNode,
        bytes32 workersAcmeNode
    ) internal {
        // Re-derive the first two leaf values for credential records
        uint256 BN254_P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        uint256 leaf0 = PoseidonT3.hash2(0, uint256(keccak256(abi.encodePacked("badge-", uint256(0)))) % BN254_P);
        uint256 leaf1 = PoseidonT3.hash2(0, uint256(keccak256(abi.encodePacked("badge-", uint256(1)))) % BN254_P);

        bytes32 worker7f3aNode = keccak256(abi.encodePacked(workersAcmeNode, keccak256("worker-7f3a")));
        bytes32 workerC12dNode = keccak256(abi.encodePacked(workersAcmeNode, keccak256("worker-c12d")));

        res.setSubText(acmeNode, worker7f3aNode, "shieldpass.zk-credential",    vm.toString(bytes32(leaf0)));
        res.setSubText(acmeNode, worker7f3aNode, "shieldpass.reports-submitted", "0");
        res.setSubText(acmeNode, workerC12dNode, "shieldpass.zk-credential",    vm.toString(bytes32(leaf1)));
        res.setSubText(acmeNode, workerC12dNode, "shieldpass.reports-submitted", "0");
    }
}
