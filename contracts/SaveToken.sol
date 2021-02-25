// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./libraries/ERC20StorageLib.sol";
import "./libraries/RewardsLib.sol";
import "./libraries/StorageLib.sol";
import "./interfaces/ISaveToken.sol";
import "./interfaces/IERC165.sol";
import "./interfaces/IInsurance.sol";
import "./interfaces/IAsset.sol";
import "./token/ERC20.sol";
import "./utils/Pausable.sol";

contract SaveToken is ERC20, Pausable {
    using SafeMath for uint256;

    mapping (address => uint256) public assetBalances;
    mapping (address => uint256) public insuranceBalances;

    address public underlyingTokenAddress;
    address public assetAdapter;
    address public assetToken;
    address public insuranceAdapter;
    address public insuranceToken;
    address public uniswapFactory;
    address public pauser;

    IERC20 public underlyingToken;

    /***************
    EVENTS
    ***************/
    event Mint(uint256 amount, address user);
    event WithdrawForUnderlyingAsset(uint256 amount, address user);
    event WithdrawReward(uint256 amount, address user);
    event RewardsBalance(uint256 amount, address user);

    constructor(
        address _underlyingTokenAddress,
        address _assetAdapter,
        address _assetToken,
        address _insuranceAdapter,
        address _insuranceToken,
        address _uniswapFactory,
        address _rewardsLogic,
        address _admin,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
        )
        {
        underlyingTokenAddress = _underlyingTokenAddress;
        assetAdapter = _assetAdapter;
        assetToken = _assetToken;
        insuranceAdapter = _insuranceAdapter;
        insuranceToken = _insuranceToken;
        uniswapFactory = _uniswapFactory;
        pauser = _admin;

        underlyingToken = IERC20(underlyingTokenAddress);

        StorageLib.setAddresses(
            underlyingTokenAddress, 
            assetAdapter, 
            assetToken, 
            insuranceAdapter, 
            insuranceToken, 
            _uniswapFactory
        );

        if (_rewardsLogic != address(0)) {
            RewardsLib.setLogicAddress(_rewardsLogic);
        }

        ERC20StorageLib.setERC20Metadata(_name, _symbol, _decimals);

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
        uint256 assetCost = _delegatecall(assetAdapter, signature_cost);
        uint256 insuranceCost = _delegatecall(insuranceAdapter, signature_insurance);
    
        // transfer total underlying token needed
        require(
            underlyingToken.transferFrom(
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

        uint256 assetTokens = _delegatecall(assetAdapter, signature_hold);
        uint256 insuranceTokens = _delegatecall(insuranceAdapter, signature_buy);

        require(assetTokens == amount, "assetTokens must equal amount");
        require(insuranceTokens == amount, "insuranceTokens must equal amount");

        _mint(msg.sender, amount);

        // update asset and insurance token balances
        assetBalances[msg.sender] = assetBalances[msg.sender].add(assetTokens);
        insuranceBalances[msg.sender] = insuranceBalances[msg.sender].add(insuranceTokens);

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
            _delegatecall(assetAdapter, signature_transfer);
        }

        // transfer saveTokens
        super.transfer(recipient, amount);

        // update asset and insurance token balances
        assetBalances[msg.sender] = assetBalances[msg.sender].sub(amount);
        insuranceBalances[msg.sender] = insuranceBalances[msg.sender].sub(amount);

        assetBalances[recipient] = assetBalances[recipient].add(amount);
        insuranceBalances[recipient] = insuranceBalances[recipient].add(amount);

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
            _delegatecall(assetAdapter, signature_transfer);
        }

        // transfer saveTokens
        super.transferFrom(sender, recipient, amount);

        // update asset and insurance token balances
        assetBalances[sender] = assetBalances[sender].sub(amount);
        insuranceBalances[sender] = insuranceBalances[sender].sub(amount);

        assetBalances[recipient] = assetBalances[recipient].add(amount);
        insuranceBalances[recipient] = insuranceBalances[recipient].add(amount);

        return true;
    }

    /// @notice This function will unbundle your SaveTokens for your underlying asset
    /// @param amount The number of SaveTokens to unbundle
    function withdrawForUnderlyingAsset(uint256 amount) external {
        bytes memory signature_withdraw = abi.encodeWithSignature(
            "withdraw(uint256)",
            amount
        );

        bytes memory signature_sellInsurance = abi.encodeWithSignature(
            "sellInsurance(uint256)",
            amount
        );

        uint256 underlyingForAsset = _delegatecall(assetAdapter, signature_withdraw);
        uint256 underlyingForInsurance = _delegatecall(insuranceAdapter, signature_sellInsurance);

        //transfer underlying to msg.sender
        require(underlyingToken.transfer(msg.sender, underlyingForAsset.add(underlyingForInsurance)));

        // update asset and insurance token balances
        assetBalances[msg.sender] = assetBalances[msg.sender].sub(amount);
        insuranceBalances[msg.sender] = insuranceBalances[msg.sender].sub(amount);

        emit WithdrawForUnderlyingAsset(amount, msg.sender);

        _burn(msg.sender, amount);
    }

    /// @notice Allows admin to pause contract
    function pause() external {
        require(pauser == msg.sender, "Caller must be admin");
        _pause();
    }

    /// @notice Allows admin to unpause contract
    function unpause() external {
        require(pauser == msg.sender, "Caller must be admin");
        _unpause();
    }

    /// @notice This function will withdraw all reward tokens
    /// @return amount Returns the amount of reward tokens withdrawn
    function withdrawReward() external returns (uint256) {
        bytes memory signature_withdrawReward = abi.encodeWithSignature("withdrawReward()");

        uint256 balance = _delegatecall(assetAdapter, signature_withdrawReward);

        emit WithdrawReward(balance, msg.sender);
        return balance;
    }

    /// @dev Returns the rewards token balance that has accured
    /// @return Returns the balance of rewards tokens
    function getRewardsBalance() external returns (uint256) {
        bytes memory signature_getRewardsBalance = abi.encodeWithSignature("getRewardsBalance()");
        uint256 balance = _delegatecall(assetAdapter, signature_getRewardsBalance);
        
        emit RewardsBalance(balance, msg.sender);
        return balance;
    }

    /***************
    INTERNAL FUNCTIONS
    ***************/
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
