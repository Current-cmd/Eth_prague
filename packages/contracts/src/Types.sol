// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

struct RootEntry { bytes32 root; uint64 setAt; }

enum ReportCategory {
    Misconduct,            // 0
    SelectiveDisclosure,   // 1
    Misclassification,     // 2
    HollowPromise,         // 3
    InNameOnly,            // 4
    MisleadingPresentation // 5
}
