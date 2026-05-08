// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IBadgeTreeManager {
    event RootRotated(bytes32 indexed ensNode, bytes32 newRoot, bytes32 prevRoot);
    function rotateRoot(bytes32 ensNode, bytes32 newRoot) external;
    function isRootFresh(bytes32 ensNode, bytes32 root) external view returns (bool);
}
