// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

library StorageLib {
    bytes32 constant SAVETOKEN_STORAGE_POSITION = keccak256(
        "save.token.save.storage"
    );

    struct SaveTokenStorage {
        mapping(bytes4 => bool) supportedInterfaces;
        address underlyingToken;
        address assetAdapter;
        address insuranceAdapter;
        address assetToken;
        address insuranceToken;
        address uniswapFactory;
    }

    function saveTokenStorage()
        internal
        pure
        returns (SaveTokenStorage storage st)
    {
        bytes32 position = SAVETOKEN_STORAGE_POSITION;
        assembly {
            st_slot := position
        }
    }
    
    function setAddresses(
        address _underlyingToken,
        address _assetAdapter,
        address _assetToken,
        address _insuranceAdapter,
        address _insuranceToken,
        address _uniswapFactory
    ) internal {
        SaveTokenStorage storage st = saveTokenStorage();
        st.underlyingToken = _underlyingToken;
        st.assetAdapter = _assetAdapter;
        st.assetToken = _assetToken;
        st.insuranceAdapter = _insuranceAdapter;
        st.insuranceToken = _insuranceToken;
        st.uniswapFactory = _uniswapFactory;
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

    function uniswapFactory() internal view returns (address uniswapFactory_) {
        uniswapFactory_ = saveTokenStorage().uniswapFactory;
    }
}
