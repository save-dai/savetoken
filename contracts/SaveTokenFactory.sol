// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./SaveToken.sol";

contract SaveTokenFactory {

    // addresses of deployed saveTokens
    address[] public saveTokens;
    address public admin;

    event SaveTokenCreated(address addr);

    constructor(address _admin) public {
        admin = _admin;
    }

    /*
     * @notice creates a new SaveToken contract
     * @param underlyingToken The underlying token address
     * @param assetAdapter The address of the Asset adapter a token will use
     * @param assetToken The addresses for the asset token
     * @param insuranceAdapter The address of the Insurance adapter a token will use
     * @param insuranceToken The addresses for the insurance token
     * @param uniswapFactory The addresses for the Uniswap factory token
     * @param farmerAddress The addresses for the SaveToken farmer
     */
    function createSaveToken(
        address underlyingToken,
        address assetAdapter,
        address assetToken,
        address insuranceAdapter,
        address insuranceToken,
        address uniswapFactory,
        address farmerAddress,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public returns (address) {
        SaveToken saveToken = new SaveToken(
            underlyingToken,
            assetAdapter,
            assetToken,
            insuranceAdapter,
            insuranceToken,
            uniswapFactory,
            farmerAddress,
            admin,
            name,
            symbol,
            decimals
        );

        saveTokens.push(address(saveToken));
        emit SaveTokenCreated(address(saveToken));

        return address(saveToken);
    }
}
