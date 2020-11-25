// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface ISaveToken {
    function mint(uint256 _amount) external returns (uint256);
    function withdrawForUnderlyingAsset(uint256 _amount) external;
}