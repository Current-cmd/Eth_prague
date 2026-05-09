// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IShieldPassResolver {
    function setText(bytes32 parentNode, string calldata key, string calldata value) external;
    function setSubText(bytes32 parentNode, bytes32 subnode, string calldata key, string calldata value) external;
}
