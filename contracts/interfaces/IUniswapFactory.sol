// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

// Solidity Interface
interface IUniswapFactory {
    // Get Exchange and Token Info
    function getExchange(address token) external view returns (address exchange);
}