// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library StorageLib {
    bytes32 constant SAVETOKEN_STORAGE_POSITION = keccak256(
        "save.token.save.storage"
    );

    struct SaveTokenStorage {
        address underlyingToken;
        address assetAdapter;
        address insuranceAdapter;
        address assetToken;
        address insuranceToken;
        address exchangeFactory;
        address saveToken;
        address admin;
        IERC20 underlyingInstance;
        // TODO: remove assetBalances mapping
        mapping(address => uint256) assetBalances;
        // TODO: remove insuranceBalances mapping
        mapping(address => uint256) insuranceBalances;
    }

    function saveTokenStorage()
        internal
        pure
        returns (SaveTokenStorage storage st)
    {
        bytes32 position = SAVETOKEN_STORAGE_POSITION;
        assembly {
            st.slot := position
        }
    }
    
    function setAddresses(
        address _underlyingToken,
        address _assetAdapter,
        address _assetToken,
        address _insuranceAdapter,
        address _insuranceToken,
        address _exchangeFactory,
        address _saveToken,
        address _admin
    ) internal {
        SaveTokenStorage storage st = saveTokenStorage();
        st.underlyingToken = _underlyingToken;
        st.assetAdapter = _assetAdapter;
        st.assetToken = _assetToken;
        st.insuranceAdapter = _insuranceAdapter;
        st.insuranceToken = _insuranceToken;
        st.exchangeFactory = _exchangeFactory;
        st.saveToken = _saveToken;
        st.admin = _admin;
        st.underlyingInstance = IERC20(_underlyingToken);
    }

    // TODO: Remove as we will instead read balances directly from proxies
    function updateAssetBalance(address _user, uint256 _amount) internal {
        SaveTokenStorage storage st = saveTokenStorage();
        st.assetBalances[_user] = _amount;
    }

    // TODO: Remove as we will instead read balances directly from proxies
    function updateInsuranceBalance(address _user, uint256 _amount) internal {
        SaveTokenStorage storage st = saveTokenStorage();
        st.insuranceBalances[_user] = _amount;
    }

    //TODO: Update so this reads balances from the account's proxy
    function getAssetBalance(address _user) internal view returns (uint256) {
        return saveTokenStorage().assetBalances[_user];
    }

    //TODO: Update so this reads balances from the account's proxy
    function getInsuranceBalance(address _user) internal view returns (uint256) {
        return saveTokenStorage().insuranceBalances[_user];
    }

    function underlyingInstance() internal view returns (IERC20 underlyingInstance_) {
        underlyingInstance_ = saveTokenStorage().underlyingInstance;
    }

    function underlyingToken() internal view returns (address underlyingToken_) {
        underlyingToken_ = saveTokenStorage().underlyingToken;
    }

    function assetAdapter() internal view returns (address assetAdapter_) {
        assetAdapter_ = saveTokenStorage().assetAdapter;
    }

    function assetToken() internal view returns (address assetToken_) {
        assetToken_ = saveTokenStorage().assetToken;
    }

    function insuranceAdapter() internal view returns (address assetAdapter_) {
        assetAdapter_ = saveTokenStorage().insuranceAdapter;
    }

    function insuranceToken() internal view returns (address assetToken_) {
        assetToken_ = saveTokenStorage().insuranceToken;
    }

    function exchangeFactory() internal view returns (address exchangeFactory_) {
        exchangeFactory_ = saveTokenStorage().exchangeFactory;
    }

    function saveToken() internal view returns (address saveToken_) {
        saveToken_ = saveTokenStorage().saveToken;
    }
    
    function admin() internal view returns (address admin_) {
        admin_ = saveTokenStorage().admin;
    }

    function getAddresses() 
        internal 
        view 
        returns (address, address, address, address, address)
        {
        return (underlyingToken(), assetAdapter(), assetToken(), insuranceAdapter(), insuranceToken());
    }
}
