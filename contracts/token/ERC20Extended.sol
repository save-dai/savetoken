// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/ERC20StorageLib.sol";

import "./ERC20Metadata.sol";
import "./ERC20Base.sol";

contract ERC20Extended is ERC20Base, ERC20Metadata {
    using SafeMath for uint256;

    function increaseAllowance(address spender, uint256 amount)
        public
        virtual
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            ERC20StorageLib.saveToken_ERC20().allowances[msg.sender][spender]
                .add(amount)
        );
        return true;
    }

    function decreaseAllowance(address spender, uint256 amount)
        public
        virtual
        returns (bool)
    {
        _approve(
            msg.sender,
            spender,
            ERC20StorageLib.saveToken_ERC20().allowances[msg.sender][spender]
                .sub(amount)
        );
        return true;
    }
}
