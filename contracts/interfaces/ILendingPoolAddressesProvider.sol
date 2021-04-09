// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

// Aave LendingPool interface
interface ILendingPoolAddressesProvider {
    function getLendingPool() external view returns (address);
}