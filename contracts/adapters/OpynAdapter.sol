// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../interfaces/IInsurance.sol";

contract OpynAdapter is IInsurance {

    function buyInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
    {
        return amount;
    }

    function getCostOfInsuranceToken(uint256 amount)
        external
        override(IInsurance)
        returns (uint256)
    {
        return amount + 100;
    }
}
