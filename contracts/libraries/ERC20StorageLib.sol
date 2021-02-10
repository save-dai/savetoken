// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

library ERC20StorageLib {
    bytes32 constant SAVETOKEN_ERC20 = keccak256("save.token.storage.ERC20");

    struct ERC20Storage {
        string name;
        string symbol;
        uint8 decimals;
        mapping(address => uint256) balances;
        mapping(address => mapping(address => uint256)) allowances;
        uint256 totalSupply;
    }

    function saveToken_ERC20() internal pure returns (ERC20Storage storage ds) {
        bytes32 slot = SAVETOKEN_ERC20;
        assembly {
            ds.slot := slot
        }
    }

    function setERC20Metadata(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) internal {
        ERC20Storage storage ds = saveToken_ERC20();
        ds.name = name;
        ds.symbol = symbol;
        ds.decimals = decimals;
    }
}
