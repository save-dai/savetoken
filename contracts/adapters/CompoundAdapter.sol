// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../rewards-farmer/FarmerFactory.sol";
import "../rewards-farmer/COMPFarmer.sol";
import "../libraries/RewardsLib.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/IAsset.sol";
import "../interfaces/ICToken.sol";

contract CompoundAdapter is IAsset, FarmerFactory {
	using SafeMath for uint256;

    address internal compToken;

    event ExchangeRate(uint256 exchangeRate);

    constructor(address comp) public {
        compToken = comp;
    }

    function hold(uint256 amount) 
    	external 
    	override(IAsset)
    	returns (uint256) 
    {
        ICToken cToken = ICToken(StorageLib.assetToken());
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        
        address proxy;
        // if user does not have a proxy, deploy proxy
        if (RewardsLib.farmerProxyAddress(msg.sender) == address(0)) {
            proxy = deployProxy(
                address(cToken),
                address(underlyingToken),
                compToken
            );
            // set mapping of user address to proxy
            RewardsLib.setFarmerProxy(msg.sender, proxy);
        } else {
            proxy = RewardsLib.farmerProxyAddress(msg.sender);
        }

        // transfer underlying to the user's COMPFarmer to mint cToken
        require(underlyingToken.transfer(proxy, amount));

        // mint the interest bearing token
        uint256 assetAmount = COMPFarmer(proxy).mint();
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
