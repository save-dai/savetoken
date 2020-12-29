// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IInsurance {
    function buyInsurance(uint256 amount) external returns (uint256);
    function getCostOfInsurance(uint256 amount) external view returns (uint256);
}
