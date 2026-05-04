// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IProtocolSafetyFacet {
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event MarketCancelled(uint256 indexed marketId, address indexed by);
    event ETHRecovered(address indexed to, uint256 amount);

    function pause() external;
    function unpause() external;
    function cancelMarket(uint256 marketId) external;
    function recoverETH(address to, uint256 amount) external;
    function isPaused() external view returns (bool);
    function isCancelled(uint256 marketId) external view returns (bool);
}
