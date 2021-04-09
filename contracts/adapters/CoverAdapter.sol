// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IInsurance.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/IBalancerPool.sol";
import "../interfaces/ICoverToken.sol";

contract CoverAdapter is IInsurance {
    using SafeMath for uint256;

    function buyInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {   
        address covToken = StorageLib.insuranceToken();
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        IBalancerPool balancerPool = IBalancerPool(StorageLib.exchangeFactory());

        // approve the transfer
        underlyingToken.approve(address(balancerPool), amount );

        (uint256 tokensOut,) = balancerPool.swapExactAmountIn(
            address(underlyingToken), // tokenIn
            amount, // tokenAmountIn
            address(covToken), // tokenOut
            1, // minAmountOut
            type(uint256).max // maxPrice
        );
        return tokensOut;
    }

    function sellInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {
        address covToken = StorageLib.insuranceToken();
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        IBalancerPool balancerPool = IBalancerPool(StorageLib.exchangeFactory());

        // approve the transfer
        underlyingToken.approve(address(balancerPool), amount );

        require(isActive(), "must not be expired");

        (uint256 tokensOut,) = balancerPool.swapExactAmountIn(
                address(covToken), // tokenIn
                amount, // tokenAmountIn
                address(underlyingToken), // tokenOut
                1, // minAmountOut
                type(uint256).max // maxPrice
            );
        return tokensOut;
    }

    /// @notice This function calculates the premiums to be paid if a buyer wants to
    /// buy covTokens on Balancer

    function getCostOfInsurance(uint256 amount)
        external
        view
        override(IInsurance)
        returns (uint256)
        {
        address covToken = StorageLib.insuranceToken();
        address underlyingToken = StorageLib.underlyingToken();
        IBalancerPool balancerPool = IBalancerPool(StorageLib.exchangeFactory());

        uint256 tokenBalanceIn = balancerPool.getBalance(underlyingToken);
        uint256 tokenWeightIn = balancerPool.getNormalizedWeight(underlyingToken);
        uint256 tokenBalanceOut = balancerPool.getBalance(covToken);
        uint256 tokenWeightOut = balancerPool.getNormalizedWeight(covToken);
        uint256 swapFee = balancerPool.getSwapFee();

        return balancerPool.calcInGivenOut(
                tokenBalanceIn,
                tokenWeightIn,
                tokenBalanceOut,
                tokenWeightOut,
                amount, // token amount out
                swapFee
            );
    }

    /// @dev Check expiration status of insurance token
    /// @return Returns true if insurance token has NOT expired
    function isActive() 
        public 
        view
        override(IInsurance) 
        returns (bool) 
        {
        ICoverToken covToken = ICoverToken(StorageLib.insuranceToken());
        return block.timestamp < covToken.expirationTimestamp();
    }

}
