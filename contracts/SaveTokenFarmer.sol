// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "rewards-farmer/contracts/Farmer.sol";
import "./interfaces/ISaveTokenFarmer.sol";
import "./interfaces/IAsset.sol";
import "./interfaces/IComptrollerLens.sol";

 /// @dev The SaveTokenFarmer contract inherits from the base Farmer contract and
 /// is extended to support necessary functionality associated with rewards and governance tokens.
contract SaveTokenFarmer is ISaveTokenFarmer, Farmer {
	using SafeMath for uint256;

	// interfaces
    IERC20 public underlyingToken;
    IAsset public assetAdapter;
    IERC20 public rewardsToken;

    /// @dev Initializer function to launch proxy.
    /// @param _owner The address that will be the owner of the SaveTokenFarmer.
    /// @param _adapterAddress The address of the asset adapter.
    /// @param _underlyingToken The address of the underlying token.
    /// @param _rewardsToken The address of the rewards / governance token.
    function initialize(
        address _owner,
        address _adapterAddress,
        address _underlyingToken,
        address _rewardsToken
    )
        public
    {
        Farmer.initialize(_owner);
        assetAdapter = IAsset(_adapterAddress);
        underlyingToken = IERC20(_underlyingToken);
    	rewardsToken = IERC20(_rewardsToken);
    }

    /// @dev Mint the asset token that sits in the contract and accrues interest as
    /// well as the corresponding governance / rewards tokens
    /// @return The amount of asset tokens minted.
    function mint() 
        external 
        override 
        onlyOwner 
        returns (uint256) 
    {
        // identify the current balance of the contract
        uint256 underlyingBalance = underlyingToken.balanceOf(address(this));

        // approve the transfer
        underlyingToken.approve(address(assetAdapter), underlyingBalance);

        // mints cDAI tokens and returns the amount minted
        return _mintAssetToken(underlyingBalance);
    }

    /***************
    INTERNAL FUNCTIONS
    ***************/

    /// @notice This function mints the asset tokens
    /// @param _amount The number of asset tokens minted
    function _mintAssetToken(uint256 _amount) 
        internal 
        returns (uint256) 
    {
        // identify the current balance of the contract
        uint256 initialBalance = assetAdapter.balanceOf(address(this));
        // mint asset tokens
        assetAdapter.hold(_amount);
        // identify the updated balance of the contract
        uint256 updatedBalance = assetAdapter.balanceOf(address(this));
        // return number of asset tokens minted
        return updatedBalance.sub(initialBalance);
    }
}