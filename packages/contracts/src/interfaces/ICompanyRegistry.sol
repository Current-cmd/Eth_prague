// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface ICompanyRegistry {
    event CompanyRegistered(bytes32 indexed ensNode, address admin);
    function register(bytes32 ensNode, address admin) external;
    function isActive(bytes32 ensNode) external view returns (bool);
    function adminOf(bytes32 ensNode) external view returns (address);
}
