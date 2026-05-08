// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBadgeTreeManager} from "./interfaces/IBadgeTreeManager.sol";
import {ICompanyRegistry}  from "./interfaces/ICompanyRegistry.sol";
import {RootEntry}         from "./Types.sol";

contract BadgeTreeManager is IBadgeTreeManager {
    uint256 constant ROOT_HISTORY_DEPTH = 8;
    uint256 constant FRESHNESS_SECONDS  = 7 days;

    ICompanyRegistry public immutable registry;
    mapping(bytes32 => RootEntry[ROOT_HISTORY_DEPTH]) private _history;
    mapping(bytes32 => uint8)  private _cursor;       // points to LATEST written slot
    mapping(bytes32 => bool)   private _initialized;  // true after first rotation

    constructor(address registry_) { registry = ICompanyRegistry(registry_); }

    modifier onlyAdmin(bytes32 ensNode) {
        require(msg.sender == registry.adminOf(ensNode), "not-admin");
        _;
    }

    function rotateRoot(bytes32 ensNode, bytes32 newRoot) external onlyAdmin(ensNode) {
        bytes32 prev = _initialized[ensNode]
            ? _history[ensNode][_cursor[ensNode]].root
            : bytes32(0);
        uint8 next = _initialized[ensNode]
            ? uint8((_cursor[ensNode] + 1) % ROOT_HISTORY_DEPTH)
            : 0;
        _history[ensNode][next] = RootEntry(newRoot, uint64(block.timestamp));
        _cursor[ensNode]      = next;
        _initialized[ensNode] = true;
        emit RootRotated(ensNode, newRoot, prev);
    }

    function isRootFresh(bytes32 ensNode, bytes32 root) external view returns (bool) {
        for (uint8 i; i < ROOT_HISTORY_DEPTH; ++i) {
            RootEntry memory e = _history[ensNode][i];
            // e.setAt != 0 is the zero-slot guard: unwritten slots have setAt == 0
            if (e.setAt != 0 && e.root == root && block.timestamp - e.setAt <= FRESHNESS_SECONDS) {
                return true;
            }
        }
        return false;
    }
}
