// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IRiscZeroVerifier} from "../src/interfaces/IRiscZeroVerifier.sol";

contract MockVerifier is IRiscZeroVerifier {
    // Accepts any seal/imageId/journalDigest — for testing only
    function verify(bytes calldata, bytes32, bytes32) external pure {}
}
