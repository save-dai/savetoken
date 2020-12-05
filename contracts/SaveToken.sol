// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "rewards-farmer/contracts/FarmerFactory.sol";
import "./libraries/StorageLib.sol";
import "./libraries/ERC20StorageLib.sol";
import "./interfaces/ISaveToken.sol";
import "./interfaces/IERC165.sol";
import "./interfaces/IInsurance.sol";
import "./interfaces/IAsset.sol";
import "./token/ERC20.sol";

contract SaveToken is ISaveToken, ERC20, FarmerFactory {
    address public underlyingTokenAddress;
    address public assetAdapter;
    address public assetToken;
    address public insuranceAdapter;
    address public insuranceToken;
    address public uniswapFactory;
    address public rewardsToken;
    address public farmerAddress;
    IERC20 public underlyingToken;

    /***************
    EVENTS
    ***************/
    event Mint(uint256 _amount, address _recipient) ;

    constructor(
        address _underlyingTokenAddress,
        address _assetAdapter,
        address _assetToken,
        address _insuranceAdapter,
        address _insuranceToken,
        address _uniswapFactory,
        address _rewardsToken,
        address _farmerAddress,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    )
        FarmerFactory(_farmerAddress)
        public
    {
        underlyingTokenAddress = _underlyingTokenAddress;
        assetAdapter = _assetAdapter;
        assetToken = _assetToken;
        insuranceAdapter = _insuranceAdapter;
        insuranceToken = _insuranceToken;
        rewardsToken = _rewardsToken;
        farmerAddress = _farmerAddress;
        uniswapFactory = _uniswapFactory;

        underlyingToken = IERC20(underlyingTokenAddress);

        StorageLib.setAddresses(
            underlyingTokenAddress, 
            assetAdapter, 
            assetToken, 
            insuranceAdapter, 
            insuranceToken, 
            _uniswapFactory
        );

        ERC20StorageLib.setERC20Metadata(_name, _symbol, _decimals);

        StorageLib.SaveTokenStorage storage st = StorageLib.saveTokenStorage();

        // solhint-disable-next-line
        st.supportedInterfaces[type(IERC165).interfaceId] = true;
    }

    /// @notice This function mints SaveTokens
    /// @param amount The number of SaveTokens to mint
    /// @return Returns the total number of SaveTokens minted
    function mint(uint256 amount) 
        external 
        override(ISaveToken) 
        returns (uint256) 
    {
        bytes memory signature_cost = abi.encodeWithSignature(
            "getCostofAsset(uint256)",
            amount
        );
        bytes memory signature_insurance = abi.encodeWithSignature(
            "getCostOfInsuranceToken(uint256)",
            amount
        );
        bytes memory signature_hold = abi.encodeWithSignature(
            "hold(uint256)",
            amount
        );
        bytes memory signature_buy = abi.encodeWithSignature(
            "buyInsurance(uint256)",
            amount
        );
    
        address proxy;

        // if msg.sender does not have a proxy, deploy proxy
        if (farmerProxy[msg.sender] == address(0)) {
            proxy = deployProxy(
                msg.sender,
                assetAdapter,
                underlyingTokenAddress,
                farmerAddress);
        } else {
            proxy = farmerProxy[msg.sender];
        }
    
        uint256 assetCost = _delegatecall(assetAdapter, signature_cost);
        uint256 insuranceTokenCost = _delegatecall(insuranceAdapter, signature_insurance);

        // transfer total DAI needed
        require(
            underlyingToken.transferFrom(
                msg.sender,
                address(this),
                (assetCost.add(insuranceTokenCost))
            )
        );

        uint256 assetTokens = _delegatecall(assetAdapter, signature_hold);
        uint256 insuranceTokens = _delegatecall(insuranceAdapter, signature_buy);

        require(assetTokens == amount, "assetTokens must equal amount");
        require(insuranceTokens == amount, "insuranceTokens must equal amount");

        _mint(msg.sender, amount);
        
        emit Mint(amount, msg.sender);

        return amount;
    }

    /// @notice This function will unbundle your SaveTokens for your underlying asset
    /// @param amount The number of SaveTokens to unbundle
    function withdrawForUnderlyingAsset(uint256 amount)
        external
        override(ISaveToken)
    {
        require(farmerProxy[msg.sender] != address(0), 
            "The user farmer proxy must exist");

        bytes memory sigAsset = abi.encodeWithSignature(
            "withdraw(uint256)",
            amount
        );

        bytes memory sigInsurance = abi.encodeWithSignature(
            "sellInsurance(uint256)",
            amount
        );

        _delegatecall(assetAdapter, sigAsset);
        _delegatecall(insuranceAdapter, sigInsurance);
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
        return ret;
    }
    
    // solhint-disable-next-line
    receive() external payable {}
}
