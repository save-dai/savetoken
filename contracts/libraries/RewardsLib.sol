// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

library RewardsLib {
    bytes32 constant SAVETOKEN_REWARDS = keccak256(
        "save.token.rewards.storage"
    );

    struct RewardsStorage {
        mapping (address => address) farmerProxy; // maps user to their farmer proxy
        address logicContract; // farmer logic contract address
    }

    function rewardsStorage()
        internal
        pure
        returns (RewardsStorage storage rs)
        {
        bytes32 position = SAVETOKEN_REWARDS;
        assembly {
            rs.slot := position
        }
    }
    
    function setLogicAddress(address _logicContract) internal {
        RewardsStorage storage rs = rewardsStorage();
        rs.logicContract = _logicContract;
    }

    function setFarmerProxy(address _user, address _farmerProxy) internal {
        RewardsStorage storage rs = rewardsStorage();
        rs.farmerProxy[_user] = _farmerProxy;
    }

    function logicAddress() internal view returns (address logicContract_) {
        logicContract_ = rewardsStorage().logicContract;
    }

    function farmerProxyAddress(address _user)
        internal
        view
        returns (address farmerProxy_)
        {
        return rewardsStorage().farmerProxy[_user];
    }

}
