// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IInsurance {
    function buyInsurance(uint256 amount) external returns (uint256);

    // function getCostOfInsuranceToken(uint256 amount) external returns (uint256);
    // function exerciseInsurance(uint256 amount) external returns (uint256);
}
