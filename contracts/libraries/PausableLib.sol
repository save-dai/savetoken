// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

library PausableLib {
    bytes32 constant SAVETOKEN_PAUSABLE = keccak256(
        "save.token.pausable.storage"
    );

    struct PausableStorage {
        bool paused; // admin address
    }

    function pausableStorage()
        internal
        pure
        returns (PausableStorage storage ps)
        {
        bytes32 position = SAVETOKEN_PAUSABLE;
        assembly {
            ps.slot := position
        }
    }

}

