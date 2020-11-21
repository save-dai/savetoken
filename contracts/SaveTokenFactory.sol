// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./SaveToken.sol";

contract SaveTokenFactory {

    // addresses of deployed saveTokens
    address[] public saveTokens;

    event SaveTokenCreated(address addr);

    constructor() public {}

    /**
     * @notice creates a new saveToken contract
     * @param assetAdapter The address of the Asset adapter a token will use
     * @param assetToken The addresses for the asset token
     * @param insuranceAdapter The address of the Insurance adapter a token will use
     * @param insuranceToken The addresses for the insurance token
     */
    function createSaveToken(
        address underlyingToken,
        address assetAdapter,
        address assetToken,
        address insuranceAdapter,
        address insuranceToken,
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
            name,
            symbol,
            decimals
        );

        saveTokens.push(address(saveToken));
        emit SaveTokenCreated(address(saveToken));

        return address(saveToken);
    }
}
