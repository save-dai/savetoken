// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../interfaces/IAsset.sol";
import "../interfaces/ICToken.sol";

contract CompoundAdapter is IAsset {

    // interfaces
    ICToken public cDai;

    constructor(
        // address uniswapFactoryAddress,
        address cDaiAddress,
    ) public {
        cDai = ICToken(cDaiAddress);
    }

    function hold(uint256 amount) public override returns (uint256) {
        return amount;
        // will include compound's mint functionality
    }

     // calculate underlying needed to mint _amount of cToken and mint tokens
    function getCostofAsset(uint256 amount) public override returns (uint256) {
        // calculate DAI needed to mint _amount of cDAI
        uint256 exchangeRate = cDai.exchangeRateCurrent();
        emit ExchangeRate(exchangeRate);
        return _amount.mul(exchangeRate).add(10**18 - 1).div(10**18);
    }
}
