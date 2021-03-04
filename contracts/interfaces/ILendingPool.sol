// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

// Aave LendingPool interface
interface ILendingPool {
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external;
  function withdraw(
  	address asset, 
  	uint256 amount, 
  	address to
  ) external;
}
