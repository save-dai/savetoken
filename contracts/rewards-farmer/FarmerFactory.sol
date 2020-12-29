// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../libraries/RewardsLib.sol";
import "./ProxyFactory.sol";

 /// @dev Factory contract used to deploy farmer proxy contracts that store interest bearing assets
 /// and rewards / goverance tokens. You can build your own custom factory contract that inherits 
 /// from this FarmerFactory contract.
contract FarmerFactory is ProxyFactory {

    /// @dev Creates and deploys a new farmer proxy contract on behalf of the user.
    /// @param assetToken The address of the interest bearing asset token.
    /// @param underlyingToken The address of the underlying token.
    /// @param rewardsToken The address of the rewards or governance token.
    /// @return proxy Return the newly created farmer proxy's address
    function deployProxy(
        address assetToken,
        address underlyingToken,
        address rewardsToken)
        internal
        virtual
        returns (address proxy)
        {
        bytes memory data = _encodeData(
            assetToken,
            underlyingToken,
            rewardsToken
        );
        proxy = deployMinimal(RewardsLib.logicAddress(), data);
        return proxy;
    }

    /// @dev Encodes the data necessary to make low-level call and deploy the farmer proxy.
    /// @param assetToken The address of the interest bearing asset token.
    /// @param underlyingToken The address of the underlying token.
    /// @param rewardsToken The address of the rewards or governance token.
    /// @return Return the encoded data necessary to make low-level call.
    function _encodeData(
        address assetToken,
        address underlyingToken,
        address rewardsToken)
        internal
        view
        returns (bytes memory)
        {
        bytes4 selector = 0xf8c8765e;
        return abi.encodeWithSelector(
            selector,
            address(this),
            assetToken,
            underlyingToken,
            rewardsToken
        );
    }

}