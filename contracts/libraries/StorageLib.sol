pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

library StorageLib {
    bytes32 constant SAVETOKEN_STORAGE_POSITION = keccak256(
        "save.token.save.storage"
    );

    struct SaveTokenStorage {
        mapping(bytes4 => bool) supportedInterfaces;
        address assetAdapter;
        address assetToken;
        address insuranceAdapter;
        address insuranceToken;
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
        address _assetAdapter,
        address _assetToken,
        address _insuranceAdapter,
        address _insuranceToken
    ) internal {
        SaveTokenStorage storage st = saveTokenStorage();
        st.assetAdapter = _assetAdapter;
        st.assetToken = _assetToken;
        st.insuranceAdapter = _insuranceAdapter;
        st.insuranceToken = _insuranceToken;
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
}