// SPDX-License-Identifier: No License
pragma solidity >=0.6.0 <0.8.0;

interface ICoverToken {
    function expirationTimestamp() external view returns (uint48);
}