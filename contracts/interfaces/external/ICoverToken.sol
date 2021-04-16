// SPDX-License-Identifier: No License
pragma solidity >=0.6.0 <0.8.0;

/**
 * @title Cover contract interface. See {Cover}.
 * @author crypto-pumpkin@github
 */
interface ICoverToken {

    function expirationTimestamp() external view returns (uint48);
    function collateral() external view returns (address);
    function name() external view returns (string memory);
    function claimNonce() external view returns (uint256);

    function redeemClaim() external;
    function redeemNoclaim() external;
    function redeemCollateral(uint256 _amount) external;

    /// @notice access restriction - owner (Protocol)
    function mint(uint256 _amount, address _receiver) external;

    /// @notice access restriction - dev
    function setCovTokenSymbol(string calldata _name) external;
}