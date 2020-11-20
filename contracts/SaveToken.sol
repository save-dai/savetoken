pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libraries/StorageLib.sol";
import "./libraries/ERC20StorageLib.sol";
import "./interfaces/IERC165.sol";
import "./interfaces/IInsurance.sol";
import "./interfaces/IAsset.sol";
import "./token/ERC20.sol";

contract SaveToken is ERC20 {
    constructor(
        address underlyingToken,
        address assetAdapter,
        address assetToken,
        address insuranceAdapter,
        address insuranceToken,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public payable {
        StorageLib.setAddresses(assetAdapter, assetToken, insuranceAdapter, insuranceToken);

        ERC20StorageLib.setERC20Metadata(name, symbol, decimals);

        StorageLib.SaveTokenStorage storage st = StorageLib.saveTokenStorage();

        // solhint-disable-next-line
        st.supportedInterfaces[type(IERC165).interfaceId] = true;
    }

    function mint(uint256 amount) public returns (uint256) {
        address assetAddress = StorageLib.assetAdapter();
        address insuranceAddress = StorageLib.insuranceAdapter();
        address assetToken = StorageLib.assetToken();
        address insuranceToken = StorageLib.insuranceToken();

        IERC20 underlyingToken = IERC20(StorageLib.underlyingToken());

        bytes memory signature_cost = abi.encodeWithSignature(
            "getCostofAsset(uint256)",
            amount
        );
        bytes memory signature_insurance = abi.encodeWithSignature(
            "getCostofInsurance(uint256)",
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

        uint256 assetCost = _delegatecall(assetAddress, signature_cost);
        uint256 oTokenCost = _delegatecall(insuranceAddress, signature_insurance);

        // transfer total DAI needed
        require(
            underlyingToken.transferFrom(
                msg.sender,
                address(this),
                (assetCost.add(oTokenCost))
            )
        );

        uint256 assetTokens = _delegatecall(assetAddress, signature_hold);
        uint256 insuranceTokens = _delegatecall(insuranceAddress, signature_buy);

        _mint( msg.sender, amount);
        return total;
    }

    function _delegatecall(address contractAddress, bytes memory sig)
        internal
        returns (uint256)
    {
        uint256 ret;
        bool success;
        assembly {
            let output := mload(0x40)
            success := delegatecall(
                gas(),
                contractAddress,
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
