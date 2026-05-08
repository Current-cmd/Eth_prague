// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// NOTE: ICompanyRegistry is not inherited to avoid duplicate event declaration;
// CompanyRegistry satisfies the interface structurally (same function signatures).
contract CompanyRegistry {
    event CompanyRegistered(bytes32 indexed ensNode, address admin);

    struct Company { address admin; bool active; uint64 registeredAt; }
    mapping(bytes32 => Company) public companies;

    function register(bytes32 ensNode, address admin) external {
        require(companies[ensNode].registeredAt == 0, "already-registered");
        companies[ensNode] = Company(admin, true, uint64(block.timestamp));
        emit CompanyRegistered(ensNode, admin);
    }

    function isActive(bytes32 ensNode) external view returns (bool) {
        return companies[ensNode].active;
    }

    function adminOf(bytes32 ensNode) external view returns (address) {
        return companies[ensNode].admin;
    }
}
