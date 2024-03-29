// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';

 /// @dev Farmer contract used to store interest bearing assets
 /// and rewards / goverance tokens on behalf of the owner. This parent contract is 
 /// to be used as the logic contract that your custom farmer inherits from.
contract Farmer is Initializable, OwnableUpgradeable {
    /// @dev Internal function that sets current execution context.
    /// @param _owner The address that will be the owner of the farmer.
    function __Farmer_init(address _owner) internal initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Farmer_init_unchained(_owner);
    }

    /// @dev Internal function that transfers the ownership of the farmer 
    /// to the owner address argument.
    /// @param _owner The address that will become the owner of the farmer.
    function __Farmer_init_unchained(address _owner) internal initializer {
        OwnableUpgradeable.transferOwnership(_owner);
    }
}