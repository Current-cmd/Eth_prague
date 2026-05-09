// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @dev Accepts any seal — for demo/dev use only.
contract MockRisc0Verifier {
    function verify(bytes calldata, bytes32, bytes32) external pure {}
}
