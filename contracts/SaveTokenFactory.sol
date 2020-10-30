// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./SaveToken.sol";

contract SaveTokenFactory {
    
    constructor() 
        public
    {}

    function createSaveToken(
        address assetAdapter,
        address assetToken,
        address insuranceAdapter,
        address insuranceToken
        )
    public
    {
        SaveToken saveToken = new SaveToken(
            assetAdapter,
            assetToken,
            insuranceAdapter,
            insuranceToken
        );
    }
}