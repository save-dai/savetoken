// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../interfaces/IInsurance.sol";

contract OpynAdapter is IInsurance {
    // function getCostOfInsuranceToken(uint256 amount)
    //     public
    //     override
    //     returns (uint256)
    // {
    //     return amount + 100;
    // }

    function buyInsurance(uint256 amount) public override returns (uint256) {
        return amount;
    }
}
