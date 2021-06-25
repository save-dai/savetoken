// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/StorageLib.sol";
import "../../interfaces/IInsurance.sol";
import "../../token/MockInsuranceToken.sol";

contract MockInsurance is IInsurance {
    using SafeMath for uint256;

    function buyInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {       
        address insuranceToken = StorageLib.insuranceToken();
        MockInsuranceToken insuranceTokenInstance = MockInsuranceToken(insuranceToken);
        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        // approve the transfer
        underlyingToken.approve(insuranceToken, amount);

        uint256 tokensOut = insuranceTokenInstance.mint(address(this), amount);

        return tokensOut;
    }

    function sellInsurance(uint256 amount) 
        external 
        override(IInsurance)
        returns (uint256) 
        {
        address insuranceToken = StorageLib.insuranceToken();
        MockInsuranceToken insuranceTokenInstance = MockInsuranceToken(insuranceToken);

        // not selling mock insurance tokens for underlying

        uint256 tokensOut = insuranceTokenInstance.burn(address(this), amount);

        return tokensOut;
    }

    function getCostOfInsurance(uint256 amount)
        external
        pure
        override(IInsurance)
        returns (uint256)
        {
        return amount;
    }

    function claim(bytes memory data) 
        external 
        override(IInsurance)
        returns (uint256) 
        {

    }

}