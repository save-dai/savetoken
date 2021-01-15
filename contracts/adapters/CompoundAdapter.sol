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
        uint256 _amount = COMPFarmer(proxy).mint();
        return _amount;
    }

    function withdraw(uint256 amount) 
        external  
        override(IAsset)
        returns (uint256) 
        {
        // get rewards farmer proxy
        address proxy = RewardsLib.farmerProxyAddress(msg.sender);

        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        // identify SaveToken's underlying balance
        uint256 initialUnderlyingBalance = underlyingToken.balanceOf(address(this));

        COMPFarmer(proxy).redeem(amount, msg.sender);

        // identify SaveToken's updated underlying balance
        uint256 updatedUnderlyingBalance = underlyingToken.balanceOf(address(this));

        return updatedUnderlyingBalance.sub(initialUnderlyingBalance);
    }

    function transfer(address recipient, uint256 amount)
        external
        override(IAsset)
        returns (uint256)
        {
        ICToken cToken = ICToken(StorageLib.assetToken());
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        address senderProxy = RewardsLib.farmerProxyAddress(msg.sender);
        address recipientProxy = RewardsLib.farmerProxyAddress(recipient);

        // if recipient does not have a proxy, deploy a proxy
        if (recipientProxy == address(0)) {
            recipientProxy = deployProxy(
                address(cToken),
                address(underlyingToken),
                compToken
            );
            // set mapping of recipient address to proxy
            RewardsLib.setFarmerProxy(recipient, recipientProxy);
        }

        // transfer interest bearing token to recipient
        COMPFarmer(senderProxy).transfer(recipientProxy, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        external
        override(IAsset)
        returns (uint256)
        {
        ICToken cToken = ICToken(StorageLib.assetToken());
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        
        address senderProxy = RewardsLib.farmerProxyAddress(sender);
        address recipientProxy = RewardsLib.farmerProxyAddress(recipient);

        // if recipient does not have a proxy, deploy a proxy
        if (recipientProxy == address(0)) {
            recipientProxy = deployProxy(
                address(cToken),
                address(underlyingToken),
                compToken
            );
            // set mapping of recipient address to proxy
            RewardsLib.setFarmerProxy(recipient, recipientProxy);
        }

        // transfer interest bearing token to recipient
        COMPFarmer(senderProxy).transfer(recipientProxy, amount);
    }

     // calculate underlying needed to mint _amount of cToken and mint tokens
    function getCostOfAsset(uint256 amount)
        external
        override(IAsset)
        returns (uint256)
        {
        ICToken cToken = ICToken(StorageLib.assetToken());
        // calculate amount of underlying asset needed to mint amount of cToken
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
