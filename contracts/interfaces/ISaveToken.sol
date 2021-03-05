// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

interface ISaveToken {
    function mint(uint256 amount) external returns (uint256);
    function withdrawForUnderlyingAsset(uint256 amount) external;
    function withdrawReward() external returns (uint256);
    function getAssetBalance() external view returns (uint256);
    function getInsuranceBalance() external view returns (uint256);
    function balanceOf() external view returns (uint256);
}