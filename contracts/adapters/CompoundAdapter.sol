// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/IAsset.sol";
import "../interfaces/ICToken.sol";

contract CompoundAdapter is IAsset {
	using SafeMath for uint256;

    /***************
    INTERFACES
    ***************/
    ICToken public cDai;

    /***************
    EVENTS
    ***************/
    event ExchangeRate(uint256 exchangeRate);

    function hold(uint256 amount) 
    	external 
    	override(IAsset)
    	returns (uint256) 
    {
        return amount;
        // will include compound's mint functionality
    }

     // calculate underlying needed to mint _amount of cToken and mint tokens
    function getCostofAsset(uint256 amount) 
    	external
    	override(IAsset)
    	returns (uint256) 
    {
    	cDai = ICToken(StorageLib.assetToken());
        // calculate DAI needed to mint _amount of cDAI
        uint256 exchangeRate = cDai.exchangeRateCurrent();
      	emit ExchangeRate(exchangeRate);
       	return amount.mul(exchangeRate).add(10**18 - 1).div(10**18);
    }

    function balanceOf(address account) 
        external  
        override(IAsset)
        returns (uint256) 
    {
        cDai = ICToken(StorageLib.assetToken());
        return cDai.balanceOf(account);
    }
}
