// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IReportRegistry {
    event ReportSubmitted(
        bytes32 indexed ensNode,
        bytes32 indexed reportHash,
        bytes32 nullifier,
        bytes32 rootUsed,
        uint8   category,
        bytes32 pseudonymNode,
        string  cid
    );
    function submitReport(
        bytes calldata seal,
        bytes32 root,
        bytes32 reportHash,
        bytes32 nullifier,
        uint64  periodId,
        bytes32 ensNode,
        uint8   category,
        bytes32 pseudonymNode,
        string calldata cid
    ) external;
    function isNullifierUsed(bytes32 n) external view returns (bool);
}
