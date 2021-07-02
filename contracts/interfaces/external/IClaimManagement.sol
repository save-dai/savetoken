// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

interface IClaimManagement {
    function fileClaim(address _protocol, bytes32 _protocolName, uint48 _incidentTimestamp) external;
}