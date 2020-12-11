// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IInsurance {
    function buyInsurance(uint256 amount) external returns (uint256);
	function getCostOfInsurance(uint256 amount) external view returns (uint256);
	function sellInsurance(uint256 amount) external returns (uint256);
    // function exerciseInsurance(uint256 amount) external returns (uint256);
}
