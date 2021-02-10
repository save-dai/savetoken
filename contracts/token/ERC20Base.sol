// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/ERC20StorageLib.sol";

// solhint-disable-next-line
abstract contract ERC20Base is IERC20 {
    using SafeMath for uint256;

    function totalSupply() public virtual override view returns (uint256) {
        return ERC20StorageLib.saveToken_ERC20().totalSupply;
    }

    function balanceOf(address account)
        public
        virtual
        override
        view
        returns (uint256)
    {
        return ERC20StorageLib.saveToken_ERC20().balances[account];
    }

    function allowance(address holder, address spender)
        public
        virtual
        override
        view
        returns (uint256)
    {
        return ERC20StorageLib.saveToken_ERC20().allowances[holder][spender];
    }

    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _approve(
            sender,
            msg.sender,
            ERC20StorageLib.saveToken_ERC20().allowances[sender][msg.sender]
                .sub(amount, "ERC20: transfer amount exceeds allowance")
        );
        _transfer(sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        ERC20StorageLib.ERC20Storage storage ds = ERC20StorageLib
            .saveToken_ERC20();
        ds.totalSupply = ds.totalSupply.add(amount);
        ds.balances[account] = ds.balances[account].add(amount);

        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        ERC20StorageLib.ERC20Storage storage ds = ERC20StorageLib
            .saveToken_ERC20();
        ds.balances[account] = ds.balances[account].sub(amount);
        ds.totalSupply = ds.totalSupply.sub(amount);

        emit Transfer(account, address(0), amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        ERC20StorageLib.ERC20Storage storage ds = ERC20StorageLib
            .saveToken_ERC20();
        ds.balances[sender] = ds.balances[sender].sub(
            amount,
            "ERC20: transfer amount exceeds balance"
        );
        ds.balances[recipient] = ds.balances[recipient].add(amount);

        emit Transfer(sender, recipient, amount);
    }

    function _approve(
        address holder,
        address spender,
        uint256 amount
    ) internal virtual {
        require(holder != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        ERC20StorageLib.saveToken_ERC20().allowances[holder][spender] = amount;

        emit Approval(holder, spender, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}
}
