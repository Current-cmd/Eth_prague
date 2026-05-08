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
    bytes4 constant INTERFACE_EXTENDED = 0x9061b923;
    bytes4 constant SELECTOR_TEXT      = 0x59d1d43c;

    ICompanyRegistryMin public immutable registry;
    mapping(bytes32 => mapping(string => string)) public parentText;
    mapping(bytes32 => mapping(string => string)) public subText;

    // Feature 1: SpaceComputer KMS
    address public spaceComputerKMS;
    address public owner;
    address public pendingSpaceComputerKMS;

    // Feature 2: Two-Tier Badge Tree System
    mapping(bytes32 => bytes32) public activeBadgeRoot;
    mapping(bytes32 => bytes32) public allTimeBadgeRoot;

    event KMSRotated(address indexed oldKMS, address indexed newKMS);
    event ActiveBadgeRootUpdated(bytes32 indexed node, bytes32 newRoot);
    event AllTimeBadgeRootUpdated(bytes32 indexed node, bytes32 newRoot);

    constructor(address registry_, address initialKMS) { 
        registry = ICompanyRegistryMin(registry_); 
        spaceComputerKMS = initialKMS;
        owner = msg.sender;
    }

    modifier onlyAdmin(bytes32 parentNode) {
        require(msg.sender == registry.adminOf(parentNode), "not-admin");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not-owner");
        _;
    }

    modifier onlySpaceComputerKMS() {
        require(msg.sender == spaceComputerKMS, "not-kms");
        _;
    }

    // Secure KMS Rotation
    function proposeKMS(address newKMS) external onlyOwner {
        pendingSpaceComputerKMS = newKMS;
    }

    function acceptKMS() external {
        require(msg.sender == pendingSpaceComputerKMS, "not-pending-kms");
        emit KMSRotated(spaceComputerKMS, pendingSpaceComputerKMS);
        spaceComputerKMS = pendingSpaceComputerKMS;
        pendingSpaceComputerKMS = address(0);
    }

    // Root management
    function setActiveBadgeRoot(bytes32 node, bytes32 root) external onlySpaceComputerKMS {
        activeBadgeRoot[node] = root;
        emit ActiveBadgeRootUpdated(node, root);
    }

    function setAllTimeBadgeRoot(bytes32 node, bytes32 root) external onlySpaceComputerKMS {
        allTimeBadgeRoot[node] = root;
        emit AllTimeBadgeRootUpdated(node, root);
    }

    // Keep existing text functionality for normal ENS resolution
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

    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        if (bytes4(data[:4]) != SELECTOR_TEXT) return "";
        (bytes32 node, string memory key) = abi.decode(data[4:], (bytes32, string));

        string memory v = subText[node][key];
        if (bytes(v).length != 0) return abi.encode(v);

        bytes32 parent = _parentNode(name);
        return abi.encode(parentText[parent][key]);
    }

    /// DNS-wire: [len][label][len][label]...[0x00]
    /// Skips the first label, then builds node left-to-right from remaining labels.
    function _parentNode(bytes calldata dnsName) internal pure returns (bytes32 node) {
        uint256 idx = uint8(dnsName[0]) + 1;
        node = bytes32(0);
        while (idx < dnsName.length) {
            uint8 len = uint8(dnsName[idx]);
            if (len == 0) break;
            bytes32 labelHash = keccak256(dnsName[idx + 1 : idx + 1 + len]);
            node = keccak256(abi.encodePacked(node, labelHash));
            idx += 1 + len;
        }
    }
}
