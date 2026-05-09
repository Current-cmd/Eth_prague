// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IZKEmailVerifier {
    function verify(bytes calldata proof, bytes32 domainHash, bytes32 nullifier) external view returns (bool);
}
