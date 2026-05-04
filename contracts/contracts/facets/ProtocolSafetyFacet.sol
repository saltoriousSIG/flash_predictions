// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IProtocolSafetyFacet } from "../interfaces/IProtocolSafetyFacet.sol";
import { LibMarket } from "../libraries/LibMarket.sol";

contract ProtocolSafetyFacet is IProtocolSafetyFacet {
    function pause() external {
        LibMarket.enforceIsAdmin();
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        require(!ms.paused, "ALREADY_PAUSED");
        ms.paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external {
        LibMarket.enforceIsAdmin();
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        require(ms.paused, "NOT_PAUSED");
        ms.paused = false;
        emit Unpaused(msg.sender);
    }

    function cancelMarket(uint256 marketId) external {
        LibMarket.enforceIsAdmin();
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        LibMarket.Market storage market = ms.markets[marketId];
        require(!market.resolved, "MARKET_RESOLVED");
        require(!ms.cancelled[marketId], "MARKET_CANCELLED");

        ms.cancelled[marketId] = true;
        market.resolved = true;
        market.winningOptionIndex = market.options.length;
        market.resolvedAt = block.timestamp;
        market.isClosed = true;
        market.closedAt = block.timestamp;
        emit MarketCancelled(marketId, msg.sender);
    }

    function recoverETH(address to, uint256 amount) external {
        LibMarket.enforceIsAdmin();
        require(to != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "ZERO_AMOUNT");
        require(address(this).balance >= amount, "INSUFFICIENT_ETH");
        (bool success, ) = to.call{ value: amount }("");
        require(success, "ETH_TRANSFER_FAILED");
        emit ETHRecovered(to, amount);
    }

    function isPaused() external view returns (bool) {
        return LibMarket.getStorage().paused;
    }

    function isCancelled(uint256 marketId) external view returns (bool) {
        return LibMarket.getStorage().cancelled[marketId];
    }
}
