// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/StorageLib.sol";
import "../../interfaces/IInsurance.sol";

contract MockInsurance is IInsurance {
    using SafeMath for uint256;

    function buyInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {       

    }

    function sellInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {

    }

    function getCostOfInsurance(uint256 amount)
        external
        view
        override(IInsurance)
        returns (uint256)
        {

    }

}