// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IProtocolAdminFacet {
    event AdminUpdated(address indexed previousAdmin, address indexed newAdmin);
    event PlatformFeeUpdated(uint16 previousFeeBps, uint16 newFeeBps);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event CreatorFeesWithdrawn(address indexed creator, address indexed to, uint256 amount);

    function setAdmin(address newAdmin) external;
    function setPlatformFeeBps(uint16 newPlatformFeeBps) external;
    function withdrawFees(address to, uint256 amount) external;
    function withdrawCreatorFees(address to, uint256 amount) external;
    function accumulatedFees() external view returns (uint256);
    function creatorFees(address creator) external view returns (uint256);
}
