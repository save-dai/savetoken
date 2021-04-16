// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

// Aave aToken interface
interface IAToken {
    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool);
    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external;
    function mintToTreasury(uint256 amount, uint256 index) external;
    function transferOnLiquidation(
        address from,
        address to,
        uint256 value
    ) external;

    function transferUnderlyingTo(address user, uint256 amount) external returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}