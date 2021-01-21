// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

/**
 * @title Comptroller Lens Interface
 */

interface IComptrollerLens {
    function claimComp(address) external;
}