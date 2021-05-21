// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/external/IComptrollerLens.sol";
import "../interfaces/external/ICToken.sol";
import "./Farmer.sol";

 /// @dev The COMPFarmer contract inherits from the base Farmer contract and
 /// can be extended to support necessary functionality associated with
 /// how you'd like to mint, transfer, and withdraw rewards and governance tokens.
contract COMPFarmer is Farmer {
    using SafeMath for uint256;

    // interfaces
    IERC20 public underlying;
    ICToken public cToken;
    IERC20 public comp;

    /// @dev Initializer function to launch proxy.
    /// @param assetAdapter The address of the asset adapter.
    /// @param cDaiAddress The address of the cToken asset token.
    /// @param daiAddress The address of the underlying DAI token.
    /// @param compAddress The address of the rewards / governance token.
    function initialize(
        address assetAdapter,
        address cDaiAddress,
        address daiAddress,
        address compAddress)
        public
    {
        Farmer.__Farmer_init(assetAdapter);
        cToken = ICToken(cDaiAddress);
        underlying = IERC20(daiAddress);
        comp = IERC20(compAddress);
    }

    /// @dev Mint the cToken asset token that sits in the contract and accrues interest as
    /// well as the corresponding governance / rewards tokens, COMP in this examble.
    /// @return The amount of cToken minted.
    function mint() external onlyOwner returns (uint256)  {
        // identify the current balance of the contract
        uint256 daiBalance = underlying.balanceOf(address(this));

        // approve the transfer
        underlying.approve(address(cToken), daiBalance);

        uint256 initialBalance = cToken.balanceOf(address(this));

        // mint interest bearing token
        require(cToken.mint(daiBalance) == 0, "Tokens must mint");

        uint256 updatedBalance = cToken.balanceOf(address(this));

        return updatedBalance.sub(initialBalance);
    }

    /// @dev Transfer the cToken asset token.
    /// @param to The address the cToken should be transferred to.
    /// @param amount The amount of cToken to transfer.
    /// @return Returns true if succesfully executed.
    function transfer(address to, uint256 amount) external onlyOwner returns (bool) {
        require(cToken.transfer(to, amount), "must transfer");
        return true;
    }

    /// @dev Redeems the cToken asset token for DAI
    /// @param amount The amount of cToken to redeem.
    /// @param user The address to send the DAI to.
    function redeem(uint256 amount, address user) external onlyOwner {
        // Redeem returns 0 on success
        require(cToken.redeem(amount) == 0, "redeem function must execute successfully");
        
        // identify DAI balance and transfer
        uint256 daiBalance = underlying.balanceOf(address(this));
        require(underlying.transfer(user, daiBalance), "must transfer");
    }

    /// @dev Returns the COMP balance that has accured in the contract.
    /// @return Returns the balance of COMP in the contract.
    function getTotalCOMPEarned() external onlyOwner returns (uint256) {
        IComptrollerLens comptroller = IComptrollerLens(address(cToken.comptroller()));
        comptroller.claimComp(address(this));

        uint256 balance = comp.balanceOf(address(this));
        return balance;
    }

    /// @dev Allows user to withdraw the accrued COMP tokens at any time.
    /// @param user The address to send the COMP tokens to.
    function withdrawReward(address user) public onlyOwner returns (uint256) {
        IComptrollerLens comptroller = IComptrollerLens(address(cToken.comptroller()));
        comptroller.claimComp(address(this));

        uint256 balance = comp.balanceOf(address(this));
        require(comp.transfer(user, balance), "must transfer");

        return balance;
    }

}
