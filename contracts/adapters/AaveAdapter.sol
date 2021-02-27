// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/RewardsLib.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/ILendingPoolAddressesProvider.sol";
import "../interfaces/ILendingPool.sol";
import "../interfaces/IAToken.sol";
import "../interfaces/IAsset.sol";

contract AaveAdapter is IAsset {
    using SafeMath for uint256;

    function hold(uint256 amount) 
    	external
    	override(IAsset) 
    	returns (uint256) 
    	{
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        IAToken aToken = IAToken(StorageLib.assetToken());

        uint256 initialBalance = aToken.balanceOf(StorageLib.saveToken());

        address lendingPoolAddressesProviderAddress = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
        ILendingPoolAddressesProvider lendingPoolAddressProviderInstance = 
            ILendingPoolAddressesProvider(lendingPoolAddressesProviderAddress);

        address lendingPoolAddress = lendingPoolAddressProviderInstance.getLendingPool();
        ILendingPool lendingPool = ILendingPool(lendingPoolAddress);

        // Approve LendingPool contract to transfer underlying token
        underlyingToken.approve(lendingPoolAddress, amount);
        // setting Aave's referral code = 0
        lendingPool.deposit(StorageLib.underlyingToken(), amount, StorageLib.saveToken(), 0);

        uint256 endingBalance = aToken.balanceOf(StorageLib.saveToken());

        require(endingBalance.sub(initialBalance) == amount, 'Correct amount of aTokens must be minted');

        return amount;
    }

    function getCostOfAsset(uint256 amount) 
    	external
        pure
    	override(IAsset) 
    	returns (uint256) 
    	{
    	// aTokens at a 1:1 ratio with underlying tokens
    	return amount;
    }

    function withdraw(uint256 amount) 
    	external 
    	override(IAsset) 
    	returns (uint256) 
    	{

    }

    function withdrawReward() 
    	external 
    	override(IAsset) 
    	returns (uint256) 
    	{

    }

    function getRewardsBalance() 
    	external 
    	override(IAsset) 
    	returns (uint256) 
    	{

    }

    function transfer(address recipient, uint256 amount) 
    	external 
    	override(IAsset) 
    	returns (bool) 
    	{

    }

    function transferFrom(address sender, address recipient, uint256 amount)
        external
        override(IAsset)
        returns (bool) 
        {

    }

    function balanceOf(address account) 
    	external 
    	override(IAsset) 
    	returns (uint256) 
    	{

    }

}