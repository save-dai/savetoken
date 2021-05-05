// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./libraries/ERC20StorageLib.sol";
import "./libraries/RewardsLib.sol";
import "./libraries/StorageLib.sol";
import "./interfaces/ISaveToken.sol";
import "./interfaces/IERC165.sol";
import "./interfaces/IInsurance.sol";
import "./interfaces/IAsset.sol";
import "./token/ERC20Extended.sol";
import "./utils/Pausable.sol";

contract SaveToken is ERC20Extended, Pausable {
    using SafeMath for uint256;

    /***************
    EVENTS
    ***************/
    event Mint(uint256 amount, address user);
    event WithdrawForUnderlyingAsset(uint256 amount, address user);
    event WithdrawReward(uint256 amount, address user);
    event RewardsBalance(uint256 amount, address user);

    /*
     * @param underlyingTokenAddress The underlying token address
     * @param assetAdapter The address of the Asset adapter a token will use
     * @param assetToken The addresses for the asset token
     * @param insuranceAdapter The address of the Insurance adapter a token will use
     * @param insuranceToken The addresses for the insurance token
     * @param exchangeFactory The addresses for the exchange factory
     * @param rewardsLogic The logic contract for the rewards farmer proxies
     * @param admin The admin's address
     */
    constructor(
        address underlyingTokenAddress,
        address assetAdapter,
        address assetToken,
        address insuranceAdapter,
        address insuranceToken,
        address exchangeFactory,
        address rewardsLogic,
        address admin,
        string memory name,
        string memory symbol,
        uint8 decimals
        )
        {
        StorageLib.setAddresses(
            underlyingTokenAddress, 
            assetAdapter, 
            assetToken, 
            insuranceAdapter, 
            insuranceToken, 
            exchangeFactory,
            address(this),
            admin
        );

        if (rewardsLogic != address(0)) {
            RewardsLib.setLogicAddress(rewardsLogic);
        }

        ERC20StorageLib.setERC20Metadata(name, symbol, decimals);

        StorageLib.SaveTokenStorage storage st = StorageLib.saveTokenStorage();

        // solhint-disable-next-line
        st.supportedInterfaces[type(IERC165).interfaceId] = true;
    }

    /// @notice This function mints SaveTokens
    /// @param amount The number of SaveTokens to mint
    /// @return Returns the total number of SaveTokens minted
    function mint(uint256 amount) external whenNotPaused returns (uint256) {
        bytes memory signature_cost = abi.encodeWithSignature(
            "getCostOfAsset(uint256)",
            amount
        );
        bytes memory signature_insurance = abi.encodeWithSignature(
            "getCostOfInsurance(uint256)",
            amount
        );

        // get cost of tokens to know how much to transfer from user's wallet
        uint256 assetCost = _delegatecall(StorageLib.assetAdapter(), signature_cost);
        uint256 insuranceCost = _delegatecall(StorageLib.insuranceAdapter(), signature_insurance);
    
        // transfer total underlying token needed
        require(
            StorageLib.underlyingInstance().transferFrom(
                msg.sender,
                address(this),
                (assetCost.add(insuranceCost))
            )
        );

        bytes memory signature_hold = abi.encodeWithSignature(
            "hold(uint256)",
            assetCost
        );

        bytes memory signature_buy = abi.encodeWithSignature(
            "buyInsurance(uint256)",
            insuranceCost
        );

        uint256 assetTokens = _delegatecall(StorageLib.assetAdapter(), signature_hold);
        uint256 insuranceTokens = _delegatecall(StorageLib.insuranceAdapter(), signature_buy);

        _mint(msg.sender, amount);

        // update asset and insurance token balances
        StorageLib.updateAssetBalance(
            msg.sender, StorageLib.getAssetBalance(msg.sender).add(assetTokens)
        );
        StorageLib.updateInsuranceBalance(
            msg.sender, StorageLib.getInsuranceBalance(msg.sender).add(insuranceTokens)
        );
        
        emit Mint(amount, msg.sender);

        return amount;
    }

    /// @notice The saveToken transfer function. If the saveToken has a rewards
    /// farmer, call the transfer function in the Asset Adapter. This will take care
    /// transferring the asset in the rewards rarmer.
    /// @param recipient The address receiving your token.
    /// @param amount The number of tokens to transfer.
    /// @return Returns true if successfully executed.
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        
        if (RewardsLib.logicAddress() != address(0)) {
            bytes memory signature_transfer = abi.encodeWithSignature(
                "transfer(address,uint256)",
                recipient, amount
            );
            _delegatecall(StorageLib.assetAdapter(), signature_transfer);
        }

        // transfer asset and insurance tokens
        _transferTokens(msg.sender, recipient, amount);


        // transfer saveTokens
        super.transfer(recipient, amount);

        return true;
    }

    /// @dev The saveToken transferFrom function. If the saveToken has a rewards
    /// farmer, call the transfer function in the Asset Adapter. This will take care
    /// transferring the asset in the rewards rarmer.
    /// @param sender The address tokens transferred from.
    /// @param recipient The address receiving tokens.
    /// @param amount The number of tokens to transfer.
    /// @return Returns true if successfully executed.
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
        ) public override returns (bool)
        {

        if (RewardsLib.logicAddress() != address(0)) {
            bytes memory signature_transfer = abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                sender, recipient, amount
            );
            _delegatecall(StorageLib.assetAdapter(), signature_transfer);
        }

        // transfer asset and insurance tokens
        _transferTokens(sender, recipient, amount);

        // transfer saveTokens
        super.transferFrom(sender, recipient, amount);

        return true;
    }

    /// @notice This function will unbundle your SaveTokens for your underlying asset
    /// @param amount The number of SaveTokens to unbundle
    function withdrawForUnderlyingAsset(uint256 amount) external {
        require(super.balanceOf(msg.sender) > 0, "Balance must be greater than 0");

        // calculate ratio of amounts for the saveTokens that don't have a 1:1:1 mapping
        (,,uint256 assetWithdrawAmount, uint256 insuranceWithdrawAmount) = _calculateRatioAmounts(msg.sender, amount);

        bytes memory signature_withdraw = abi.encodeWithSignature(
            "withdraw(uint256)",
            assetWithdrawAmount
        );

        bytes memory signature_sellInsurance = abi.encodeWithSignature(
            "sellInsurance(uint256)",
            insuranceWithdrawAmount
        );

        uint256 underlyingForAsset = _delegatecall(StorageLib.assetAdapter(), signature_withdraw);
        uint256 underlyingForInsurance = _delegatecall(StorageLib.insuranceAdapter(), signature_sellInsurance);

        //transfer underlying to msg.sender
        require(StorageLib.underlyingInstance().transfer(msg.sender, underlyingForAsset.add(underlyingForInsurance)));

        // update asset and insurance token balances
        _subtractFromBalances(msg.sender, assetWithdrawAmount, insuranceWithdrawAmount);

        emit WithdrawForUnderlyingAsset(amount, msg.sender);

        _burn(msg.sender, amount);
    }

    /// @notice This function will withdraw all reward tokens
    /// @return amount Returns the amount of reward tokens withdrawn
    function withdrawReward() external returns (uint256) {
        bytes memory signature_withdrawReward = abi.encodeWithSignature("withdrawReward()");

        uint256 balance = _delegatecall(StorageLib.assetAdapter(), signature_withdrawReward);

        emit WithdrawReward(balance, msg.sender);
        return balance;
    }

    /// @notice Allows admin to pause contract
    function pause() external {
        require(StorageLib.admin() == msg.sender, "Caller must be admin");
        _pause();
    }

    /// @notice Allows admin to unpause contract
    function unpause() external {
        require(StorageLib.admin() == msg.sender, "Caller must be admin");
        _unpause();
    }

    /// @dev Returns the user's asset token balance
    /// @return Returns the asset balance
    function getAssetBalance(address account) external view returns (uint256) {
        return StorageLib.getAssetBalance(account);
    }

    /// @dev Returns the user's insurance token balance
    /// @return Returns the insurance balance
    function getInsuranceBalance(address account) external view returns (uint256) {
        return StorageLib.getInsuranceBalance(account);
    }

    /// @dev Returns the rewards token balance that has accured
    /// @return Returns the balance of rewards tokens
    function getRewardsBalance() external returns (uint256) {
        bytes memory signature_getRewardsBalance = abi.encodeWithSignature("getRewardsBalance()");
        uint256 balance = _delegatecall(StorageLib.assetAdapter(), signature_getRewardsBalance);
        
        emit RewardsBalance(balance, msg.sender);
        return balance;
    }

    /***************
    INTERNAL FUNCTIONS
    ***************/

    function _transferTokens(        
        address sender,
        address recipient,
        uint256 amount
        )
        internal 
        {
        // calculate ratio of amounts for the saveTokens that don't have a 1:1:1 mapping
        (
        uint256 assetBalance, 
        uint256 insuranceBalance, 
        uint256 assetTransferAmount,
        uint256 insuranceTransferAmount) = _calculateRatioAmounts(sender, amount
        );

        StorageLib.updateAssetBalance(
            sender, assetBalance.sub(assetTransferAmount)
        );
        StorageLib.updateInsuranceBalance(
            sender, insuranceBalance.sub(insuranceTransferAmount)
        ); 
        StorageLib.updateAssetBalance(
            recipient, StorageLib.getAssetBalance(recipient).add(assetTransferAmount)
        );
        StorageLib.updateInsuranceBalance(
            recipient, StorageLib.getInsuranceBalance(recipient).add(insuranceTransferAmount)
        ); 
    }

    function _subtractFromBalances(address user, uint256 assetAmount, uint256 insuranceAmount) 
        internal 
        {
        
        StorageLib.updateAssetBalance(
            user, StorageLib.getAssetBalance(user).sub(assetAmount)
        );
        StorageLib.updateInsuranceBalance(
            user, StorageLib.getInsuranceBalance(user).sub(insuranceAmount)
        ); 
    }

    function _calculateRatioAmounts(address user, uint256 amount) 
        internal
        view
        returns (uint256, uint256, uint256, uint256)
        {
        // calculate ratio of amounts, and multiply by asset and insurance token 
        // balances. This is for the saveTokens that don't have a
        // 1:1:1 mapping (saveToken:assetToken:insuranceToken)
        uint256 balance = super.balanceOf(user);
        uint256 ratio = amount.div(balance);

        uint256 assetBalance = StorageLib.getAssetBalance(user);
        uint256 insuranceBalance = StorageLib.getInsuranceBalance(user);

        uint256 assetWithdrawAmount = ratio.mul(assetBalance);
        uint256 insuranceWithdrawAmount = ratio.mul(insuranceBalance);

        return (assetBalance, insuranceBalance, assetWithdrawAmount, insuranceWithdrawAmount);
    }

    function _delegatecall(address adapterAddress, bytes memory sig)
        internal
        returns (uint256)
        {
        uint256 ret;
        bool success;
        assembly {
            let output := mload(0x40)
            success := delegatecall(
                gas(),
                adapterAddress,
                add(sig, 32),
                mload(sig),
                output,
                0x20
            )
            ret := mload(output)
        }
        require(success, "must successfully execute delegatecall");
        return ret;
    }
}
