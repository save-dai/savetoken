// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/IAsset.sol";
import "../interfaces/ICToken.sol";

contract CompoundAdapter is IAsset {
	using SafeMath for uint256;

    /***************
    EVENTS
    ***************/
    event ExchangeRate(uint256 exchangeRate);

    function hold(uint256 amount) 
    	external 
    	override(IAsset)
    	returns (uint256) 
    {

        ICToken cToken = ICToken(StorageLib.assetToken());
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        // approve the transfer
        underlyingToken.approve(address(cToken), amount);

        // identify the current balance of the SaveToken contract
        uint256 initialBalance = cToken.balanceOf(address(this));
        // mint cToken
        cToken.mint(amount);
        // identify the updated balance of the SaveToken contract
        uint256 updatedBalance = cToken.balanceOf(address(this));
        // return number of cToken tokens minted
        return updatedBalance.sub(initialBalance);
    }

    function withdraw(uint256 amount) 
        external  
        override(IAsset)
        returns (uint256) 
    {
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        // identify SaveToken's underlying balance
        uint256 initialUnderlyingBalance = underlyingToken.balanceOf(address(this));

        ICToken cToken = ICToken(StorageLib.assetToken());
        // Redeem returns 0 on success
        require(cToken.redeem(amount) == 0, "redeem function must execute successfully");

        // identify SaveToken's updated underlying balance
        uint256 updatedUnderlyingBalance = underlyingToken.balanceOf(address(this));

        return updatedUnderlyingBalance.sub(initialUnderlyingBalance);
    }

     // calculate underlying needed to mint _amount of cToken and mint tokens
    function getCostOfAsset(uint256 amount) 
    	external
    	override(IAsset)
    	returns (uint256) 
    {
    	ICToken cToken = ICToken(StorageLib.assetToken());
        // calculate DAI needed to mint _amount of cToken
        uint256 exchangeRate = cToken.exchangeRateCurrent();
      	emit ExchangeRate(exchangeRate);
       	return amount.mul(exchangeRate).add(10**18 - 1).div(10**18);
    }

    function balanceOf(address account) 
        external  
        override(IAsset)
        returns (uint256) 
    {
        ICToken cToken = ICToken(StorageLib.assetToken());
        return cToken.balanceOf(account);
    }
}
