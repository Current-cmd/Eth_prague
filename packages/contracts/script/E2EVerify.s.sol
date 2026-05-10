// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script}             from "forge-std/Script.sol";
import {console2}           from "forge-std/console2.sol";
import {CompanyRegistry}    from "../src/CompanyRegistry.sol";
import {BadgeTreeManager}   from "../src/BadgeTreeManager.sol";
import {ReportRegistry}     from "../src/ReportRegistry.sol";
import {ShieldPassResolver} from "../src/ShieldPassResolver.sol";
import {MockRisc0Verifier}  from "../src/MockRisc0Verifier.sol";

contract E2EVerify is Script {
    bytes32 constant ACME_NODE = keccak256("acme.shieldpass-demo.eth");
    bytes32 constant DEMO_ROOT = bytes32(uint256(0x1234));
    bytes32 constant REPORT_H  = keccak256("report-1");
    bytes32 constant NULLIFIER = keccak256("nullifier-1");

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(key);

        vm.startBroadcast(key);

        (CompanyRegistry cr, BadgeTreeManager btm, ReportRegistry rr, ShieldPassResolver res, address verifier)
            = _deployAll();

        _registerAndRotate(cr, btm, deployer);
        _writeResolverRecords(res);
        _submitReportAndAssertReplay(rr);

        vm.stopBroadcast();

        console2.log("E2E PASSED");
        console2.log("CompanyRegistry=%s",    address(cr));
        console2.log("BadgeTreeManager=%s",   address(btm));
        console2.log("ReportRegistry=%s",     address(rr));
        console2.log("ShieldPassResolver=%s", address(res));
        console2.log("MockRisc0Verifier=%s",  verifier);
    }

    function _deployAll() internal returns (
        CompanyRegistry cr,
        BadgeTreeManager btm,
        ReportRegistry rr,
        ShieldPassResolver res,
        address verifier
    ) {
        verifier = address(new MockRisc0Verifier());
        cr  = new CompanyRegistry();
        btm = new BadgeTreeManager(address(cr));
        rr  = new ReportRegistry(verifier, bytes32(uint256(0xCAFE)), address(btm));
        res = new ShieldPassResolver(address(cr));
    }

    function _registerAndRotate(CompanyRegistry cr, BadgeTreeManager btm, address deployer) internal {
        cr.register(ACME_NODE, deployer);
        require(cr.isActive(ACME_NODE), "E2E: company not active");
        require(cr.adminOf(ACME_NODE) == deployer, "E2E: wrong admin");
        btm.rotateRoot(ACME_NODE, DEMO_ROOT);
        require(btm.isRootFresh(ACME_NODE, DEMO_ROOT), "E2E: root not fresh");
    }

    function _writeResolverRecords(ShieldPassResolver res) internal {
        res.setText(ACME_NODE, "shieldpass.badge-tree-root", "0x1234");
        bytes32 workerNode = keccak256(abi.encodePacked(ACME_NODE, keccak256("worker-1")));
        res.setSubText(ACME_NODE, workerNode, "shieldpass.zk-credential", "leaf-1");
    }

    function _submitReportAndAssertReplay(ReportRegistry rr) internal {
        uint64 periodId = uint64(block.timestamp / 7 days);
        bytes32 worker = keccak256(abi.encodePacked(ACME_NODE, keccak256("worker-1")));
        rr.submitReport(new bytes(0), DEMO_ROOT, REPORT_H, NULLIFIER, periodId, ACME_NODE, 2, worker, "ipfs://demo");
        require(rr.isNullifierUsed(NULLIFIER), "E2E: nullifier not recorded");
        // Replay protection is exercised by ReportRegistry.t.sol (test_nullifier_replay_reverts).
    }
}
