// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/RewardsLib.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/external/ILendingPoolAddressesProvider.sol";
import "../interfaces/external/ILendingPool.sol";
import "../interfaces/external/IAToken.sol";
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

        // get Aave Lending pool instance and address
        (ILendingPool lendingPool, address lendingPoolAddress) = _getLendingPool();

        // Approve LendingPool contract to transfer underlying token
        underlyingToken.approve(lendingPoolAddress, amount);
        // setting Aave's referral code = 0
        lendingPool.deposit(StorageLib.underlyingToken(), amount, StorageLib.saveToken(), 0);

        uint256 endingBalance = aToken.balanceOf(StorageLib.saveToken());

        require(endingBalance.sub(initialBalance) == amount,
            'Correct amount of aTokens must be minted');

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
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        IAToken aToken = IAToken(StorageLib.assetToken());

        uint256 initialBalance = aToken.balanceOf(StorageLib.saveToken());

        // get Aave Lending pool instance and address
        (ILendingPool lendingPool, address lendingPoolAddress) = _getLendingPool();

        // Approve allowance so LendingPool can burn the associated aTokens
        underlyingToken.approve(lendingPoolAddress, amount);
        lendingPool.withdraw(StorageLib.underlyingToken(), amount, StorageLib.saveToken());

        uint256 endingBalance = aToken.balanceOf(StorageLib.saveToken());

        require(initialBalance.sub(endingBalance) == amount,
            'Correct amount of aTokens must be burned');

        return amount;
    }

    function withdrawReward() 
        external
        pure
        override(IAsset) 
        returns (uint256) 
        {
        // no rewards yield w/ aTokens
        return 0; 
    }

    function getRewardsBalance() 
        external
        pure
        override(IAsset) 
        returns (uint256) 
        {
        // no rewards yield w/ aTokens
        return 0; 
    }

    function transfer(address recipient, uint256 amount) 
        external 
        override(IAsset) 
        returns (bool) 
        {
        // no rewards-farmer for assets; transfer handled in SaveToken contract
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        external
        override(IAsset)
        returns (bool) 
        {
        // no rewards-farmer for assets; transfer handled in SaveToken contract
    }

    function _getLendingPool() internal view returns (ILendingPool, address) {
        address lendingPoolAddressesProviderAddress = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
        ILendingPoolAddressesProvider lendingPoolAddressProviderInstance = 
            ILendingPoolAddressesProvider(lendingPoolAddressesProviderAddress);

        address lendingPoolAddress = lendingPoolAddressProviderInstance.getLendingPool();
        ILendingPool lendingPool = ILendingPool(lendingPoolAddress);
        return (lendingPool, lendingPoolAddress);
    }

}