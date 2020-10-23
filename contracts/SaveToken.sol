pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./libraries/StorageLib.sol";
import "./libraries/ERC20StorageLib.sol";
import "./interfaces/IERC165.sol";
import "./interfaces/IInsurance.sol";
import "./interfaces/IAsset.sol";
import "./token/ERC20.sol";

contract SaveToken is ERC20 {
    constructor(
        address _assetAdapter, // Compound
        address _assetToken, // cDAI
        address _insuranceAdapter, // Opyn
        address _insuranceToken, // ocDAI
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public payable {
        StorageLib.setAddresses(
            _assetAdapter,
            _assetToken,
            _insuranceAdapter,
            _insuranceToken
        );

        ERC20StorageLib.setERC20Metadata(name, symbol, decimals);

        StorageLib.SaveTokenStorage storage st = StorageLib.saveTokenStorage();

        // solhint-disable-next-line
        st.supportedInterfaces[type(IERC165).interfaceId] = true;
    }

    function mint(address account, uint256 amount) public returns (uint256) {
        address assetAddress = StorageLib.assetAdapter();
        address insuranceAddress = StorageLib.insuranceAdapter();
        bytes memory sigAsset = abi.encodeWithSignature(
            "hold(uint256)",
            amount
        );
        bytes memory sigInsurance = abi.encodeWithSignature(
            "buyInsurance(uint256)",
            amount
        );

        uint256 assetTokens = _delegatecall(assetAddress, sigAsset);
        uint256 insuranceTokens = _delegatecall(insuranceAddress, sigInsurance);
        uint256 total = assetTokens + insuranceTokens;
        _mint(account, total);
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
