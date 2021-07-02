// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/StorageLib.sol";
import "../interfaces/external/IBalancerPool.sol";
import "../interfaces/external/IClaimManagement.sol";
import "../interfaces/external/ICoverToken.sol";
import "../interfaces/IInsurance.sol";

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
        underlyingToken.approve(address(balancerPool), amount);

        // solhint-disable-next-line
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
        IERC20 covTokenInstance = IERC20(StorageLib.insuranceToken());
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());
        IBalancerPool balancerPool = IBalancerPool(StorageLib.exchangeFactory());

        // approve the transfer
        covTokenInstance.approve(address(balancerPool), amount);

        // solhint-disable-next-line
        (uint256 tokensOut,) = balancerPool.swapExactAmountIn(
            address(StorageLib.insuranceToken()), // tokenIn
            amount, // tokenAmountIn
            address(underlyingToken), // tokenOut
            1, // minAmountOut
            type(uint256).max // maxPrice
        );
        return tokensOut;
    }

    function claim(bytes memory data)
        external 
        override(IInsurance)
        returns (uint256)
        {
        address _cm;
        address _protocol;
        bytes32 _protocolName;
        uint48 _incidentTimestamp;
        uint256 _fee;
        
        (_cm, _protocol, _protocolName, _incidentTimestamp, _fee) = 
            abi.decode(data, (address, address, bytes32, uint48, uint256));

        IClaimManagement cm = IClaimManagement(_cm);
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        // transfer total underlying token needed
        require(
            underlyingToken.transferFrom(
                msg.sender,
                address(this),
                _fee
            )
        );

        // approve the transfer
        underlyingToken.approve(_cm, _fee);

        cm.fileClaim(_protocol, _protocolName, _incidentTimestamp);
        return 0;
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

}
