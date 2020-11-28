// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../interfaces/IInsurance.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/IUniswapExchange.sol";
import "../interfaces/IUniswapFactory.sol";
import "../interfaces/IOToken.sol";

contract OpynAdapter is IInsurance {

    function buyInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
    {
        return amount;
    }

    /// @notice This function calculates the premiums to be paid if a buyer wants to
    /// buy oTokens on Uniswap
    /// @param amount The amount of oTOkens to buy
    function getCostOfInsuranceToken(uint256 amount)
        external
        override(IInsurance)
        returns (uint256)
    {
        address underlyingAddress = StorageLib.underlyingToken();
        address oToken = StorageLib.insuranceToken();

        IUniswapExchange underlyingExchange = _getExchange(underlyingAddress);
        IUniswapExchange oTokenExchange = _getExchange(oToken);

        // get the amount of ETH that needs to be paid for the amount of oTokens.
        uint256 ethToPay = oTokenExchange.getEthToTokenOutputPrice(amount);

        // get the amount of daiTokens that needs to be paid to get the desired ethToPay.
        return underlyingExchange.getTokenToEthOutputPrice(ethToPay);
    }

    /***************
    INTERNAL FUNCTIONS
    ***************/

    /// @notice This function instantiates an interface for a given exchange's address
    /// @param _tokenAddress The token's address
    function _getExchange(address _tokenAddress) internal returns (IUniswapExchange) {
        address uniswapFactoryAddress = StorageLib.uniswapFactory();
        IUniswapFactory uniswapFactory = IUniswapFactory(uniswapFactoryAddress);

        IUniswapExchange exchange = IUniswapExchange(
            uniswapFactory.getExchange(address(_tokenAddress))
        );
        return exchange;
    }
}
