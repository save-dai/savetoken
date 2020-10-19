pragma solidity ^0.6.0;

import "./SaveToken.sol";

contract SaveTokenFactory {
    
    constructor() 
        public
    {}

    function createSaveToken(
        address assetAdapter, // comound
        address assetToken, // cDai
        address insuranceAdapter, // opyn
        address insuranceToken, // ocDai
        )
    public
    {
        SaveToken saveToken = new saveToken(
            assetAdapter,
            assetToken,
            insuranceAdapter,
            insuranceToken
        )
    }
}