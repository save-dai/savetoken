// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract MockInsuranceToken is ERC20 {
    using SafeMath for uint256;

    constructor(string memory name, string memory symbol)  
    	ERC20(name, symbol) 
    	{

    }

    function mint(address account, uint256 amount) public returns (uint256) {
    	_mint(account, amount);

    	return amount;
    }

    function burn(address account, uint256 amount) public returns (uint256) {
    	_burn(account, amount);

    	return amount;
    }

}