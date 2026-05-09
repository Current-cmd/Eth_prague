// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
interface IERC165 {
    function supportsInterface(bytes4 interfaceID) external pure returns (bool);
}
interface ICompanyRegistryMin { function adminOf(bytes32) external view returns (address); }

contract ShieldPassResolver is IExtendedResolver, IERC165 {
    bytes4 constant INTERFACE_ERC165   = 0x01ffc9a7;
    bytes4 constant INTERFACE_EXTENDED = 0x9061b923; // IExtendedResolver (ENSIP-10)
    bytes4 constant SELECTOR_TEXT      = 0x59d1d43c; // text(bytes32,string)

    ICompanyRegistryMin public immutable registry;
    // parentNode => key => value  (company-level records)
    mapping(bytes32 => mapping(string => string)) public parentText;
    // subnode => key => value  (per-worker records)
    mapping(bytes32 => mapping(string => string)) public subText;

    constructor(address registry_) { registry = ICompanyRegistryMin(registry_); }

    modifier onlyAdmin(bytes32 parentNode) {
        require(msg.sender == registry.adminOf(parentNode), "not-admin");
        _;
    }

    function setText(bytes32 parentNode, string calldata key, string calldata value)
        external onlyAdmin(parentNode)
    { parentText[parentNode][key] = value; }

    function setSubText(
        bytes32 parentNode, bytes32 subnode,
        string calldata key, string calldata value
    ) external onlyAdmin(parentNode) {
        subText[subnode][key] = value;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == INTERFACE_ERC165 || id == INTERFACE_EXTENDED || id == SELECTOR_TEXT;
    }

    /// ENSIP-10: wildcard resolution entry point.
    /// `name` is the full DNS-wire-encoded name that was queried.
    /// `data` is ABI-encoded calldata for the resolution function (e.g. text(node,key)).
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        if (bytes4(data[:4]) != SELECTOR_TEXT) revert("unsupported selector");
        (bytes32 node, string memory key) = abi.decode(data[4:], (bytes32, string));

        // Per ENSIP-10 the node in calldata must match namehash(name).
        require(node == _dnsNamehash(name, 0), "node/name mismatch");

        // Prefer an explicit per-worker record.
        string memory v = subText[node][key];
        if (bytes(v).length != 0) return abi.encode(v);

        // Fall back to parent (workers.<company>.shieldpass-demo.eth) records.
        bytes32 parent = _dnsNamehash(name, 1);
        return abi.encode(parentText[parent][key]);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// Compute the ENS namehash of a DNS-wire-encoded name, skipping `skipLabels`
    /// leading labels.  skipLabels=0 → full namehash; skipLabels=1 → parent namehash.
    ///
    /// DNS wire format: [len][label][len][label]...[0x00]
    /// ENS namehash algorithm processes labels RIGHT-TO-LEFT from the TLD root.
    function _dnsNamehash(bytes calldata dnsName, uint256 skipLabels)
        internal pure returns (bytes32 node)
    {
        // Advance past the first `skipLabels` labels.
        uint256 idx = 0;
        for (uint256 s = 0; s < skipLabels && idx < dnsName.length; s++) {
            uint8 len = uint8(dnsName[idx]);
            if (len == 0) return bytes32(0); // ran out of labels
            idx += 1 + len;
        }

        // Count remaining labels.
        uint256 count = 0;
        uint256 scan = idx;
        while (scan < dnsName.length) {
            uint8 len = uint8(dnsName[scan]);
            if (len == 0) break;
            count++;
            scan += 1 + len;
        }

        // Collect label hashes in wire order (left-to-right = most-specific first).
        bytes32[] memory hashes = new bytes32[](count);
        uint256 i = 0;
        while (idx < dnsName.length) {
            uint8 len = uint8(dnsName[idx]);
            if (len == 0) break;
            hashes[i++] = keccak256(dnsName[idx + 1 : idx + 1 + len]);
            idx += 1 + len;
        }

        // Apply namehash right-to-left (TLD first, then each label outward).
        node = bytes32(0);
        uint256 k = count;
        while (k > 0) {
            k--;
            node = keccak256(abi.encodePacked(node, hashes[k]));
        }
    }
}
