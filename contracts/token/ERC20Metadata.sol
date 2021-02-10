// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "../libraries/ERC20StorageLib.sol";

contract ERC20Metadata {
    function name() public virtual view returns (string memory) {
        return ERC20StorageLib.saveToken_ERC20().name;
    }

    function symbol() public virtual view returns (string memory) {
        return ERC20StorageLib.saveToken_ERC20().symbol;
    }

    function decimals() public virtual view returns (uint8) {
        return ERC20StorageLib.saveToken_ERC20().decimals;
    }
}
