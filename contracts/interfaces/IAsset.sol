// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

interface IAsset { 
    function hold(uint256 amount) external returns (uint256);
    function getCostOfAsset(uint256 amount) external returns (uint256);
    function withdraw(uint256 amount) external returns (uint256);
    function withdrawReward() external returns (uint256);
    function getRewardsBalance() external returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount)
        external returns (bool);
    function balanceOf(address account) external returns (uint256);
}
