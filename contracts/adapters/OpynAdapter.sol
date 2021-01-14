// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

        address ocToken = StorageLib.insuranceToken();
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        IUniswapExchange underlyingExchange = _getExchange(StorageLib.underlyingToken());

        // approve the transfer
        underlyingToken.approve(address(underlyingExchange), amount );

        return 
            underlyingExchange.tokenToTokenSwapInput(
                amount, // tokens sold
                1, // min_tokens_bought
                1, // min eth bought
                1099511627776, // deadline
                address(ocToken) // token address
            );
    }

    function sellInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {   

        address underlyingToken = StorageLib.underlyingToken();
        IERC20 ocToken = IERC20(StorageLib.insuranceToken());
        IUniswapExchange ocDaiExchange = _getExchange(StorageLib.insuranceToken());

        // gives uniswap exchange allowance to transfer ocDAI tokens
        require(ocToken.approve(address(ocDaiExchange), amount));

        return ocDaiExchange.tokenToTokenSwapInput (
            amount, // tokens sold
            1, // min_tokens_bought
            1, // min eth bought
            1099511627776, // deadline
            address(underlyingToken) // token address
        );
    }

    /// @notice This function calculates the premiums to be paid if a buyer wants to
    /// buy oTokens on Uniswap
    /// @param amount The amount of oTOkens to buy
    function getCostOfInsurance(uint256 amount)
        external
        view
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
    function _getExchange(address _tokenAddress) 
        internal 
        view 
        returns 
        (IUniswapExchange) 
        {
        address uniswapFactoryAddress = StorageLib.uniswapFactory();
        IUniswapFactory uniswapFactory = IUniswapFactory(uniswapFactoryAddress);

        IUniswapExchange exchange = IUniswapExchange(
            uniswapFactory.getExchange(address(_tokenAddress))
        );
        return exchange;
    }
}
