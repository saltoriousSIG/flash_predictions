// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPredictionMarketViewFacet } from "../interfaces/IPredictionMarketViewFacet.sol";
import { LibMarket } from "../libraries/LibMarket.sol";
import { LibPredictionStorage } from "../libraries/LibPredictionStorage.sol";

contract PredictionMarketViewFacet is IPredictionMarketViewFacet {
    struct MarketSummary {
        uint256 marketId;
        string gameId;
        string question;
        string category;
        uint256 totalPool;
        uint256 closeTime;
        bool resolved;
        uint256 winningOptionIndex;
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 optionCount;
        bool isClosed;
        uint256 closedAt;
        address creator;
        uint16 creatorFeeBps;
    }

    struct OptionSummary {
        string label;
        string value;
        uint256 pool;
        uint256 bettorCount;
    }

    function getMarket(uint256 marketId) external view returns (MarketSummary memory summary) {
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.Market storage market = LibMarket.getStorage().markets[marketId];
        uint256 totalPool = LibPredictionStorage.layout().marketTotalPool[marketId];

        summary = MarketSummary({
            marketId: market.id,
            gameId: market.gameId,
            question: market.question,
            category: market.category,
            totalPool: totalPool,
            closeTime: market.closeTime,
            resolved: market.resolved,
            winningOptionIndex: market.winningOptionIndex,
            createdAt: market.createdAt,
            resolvedAt: market.resolvedAt,
            optionCount: market.options.length,
            isClosed: market.isClosed,
            closedAt: market.closedAt,
            creator: market.creator,
            creatorFeeBps: market.creatorFeeBps
        });
    }

    function getMarketOption(uint256 marketId, uint256 optionIndex) external view returns (string memory label, string memory value) {
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.Market storage market = LibMarket.getStorage().markets[marketId];
        require(optionIndex < market.options.length, "INVALID_OPTION_INDEX");
        LibMarket.Option storage option = market.options[optionIndex];
        return (option.label, option.value);
    }

    function getNextMarketId() external view returns (uint256) {
        return LibMarket.getStorage().nextMarketId;
    }

    function getToken() external view returns (address) {
        return LibMarket.getStorage().token;
    }

    function getPlatformFeeBps() external view returns (uint16) {
        return LibMarket.getStorage().platformFeeBps;
    }

    function getGameMarketIds(string calldata gameId) external view returns (uint256[] memory) {
        return LibMarket.getStorage().gameMarkets[gameId];
    }

    function getOptionSummaries(uint256 marketId) external view returns (OptionSummary[] memory summaries) {
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.Market storage market = LibMarket.getStorage().markets[marketId];
        LibPredictionStorage.Layout storage ps = LibPredictionStorage.layout();
        summaries = new OptionSummary[](market.options.length);

        for (uint256 i = 0; i < market.options.length; i++) {
            LibMarket.Option storage option = market.options[i];
            summaries[i] = OptionSummary({
                label: option.label,
                value: option.value,
                pool: ps.marketOptionPools[marketId][i],
                bettorCount: _countActivePredictionsForOption(ps, marketId, i)
            });
        }
    }

    function getAdmin() external view returns (address) {
        return LibMarket.getStorage().admin;
    }

    function isCancelled(uint256 marketId) external view returns (bool) {
        return LibMarket.getStorage().cancelled[marketId];
    }

    function isPaused() external view returns (bool) {
        return LibMarket.getStorage().paused;
    }

    function getLatestMarketId() external view returns (uint256 marketId) {
        uint256 nextMarketId = LibMarket.getStorage().nextMarketId;
        require(nextMarketId > 0, "NO_MARKETS");
        return nextMarketId - 1;
    }

    function _countActivePredictionsForOption(LibPredictionStorage.Layout storage ps, uint256 marketId, uint256 optionIndex) internal view returns (uint256 count) {
        bytes32[] storage predictionIds = ps.marketPredictionIds[marketId];
        for (uint256 i = 0; i < predictionIds.length; i++) {
            LibPredictionStorage.Prediction storage prediction = ps.predictions[predictionIds[i]];
            if (prediction.optionIndex == optionIndex && prediction.status == LibPredictionStorage.PredictionStatus.Active) {
                count++;
            }
        }
    }
}
