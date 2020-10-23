// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "../interfaces/IAsset.sol";

contract CompoundAdapter is IAsset {
    function hold(uint256 amount) public override returns (uint256) {
        // mint cDAI
        return amount;
    }

    // function getCostofAsset() public override returns (uint256) {
    //     return 4000;
    // }
}
