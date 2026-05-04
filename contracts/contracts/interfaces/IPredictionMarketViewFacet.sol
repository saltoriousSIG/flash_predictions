// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PredictionMarketViewFacet } from "../facets/PredictionMarketViewFacet.sol";

interface IPredictionMarketViewFacet {
    function getMarket(uint256 marketId) external view returns (PredictionMarketViewFacet.MarketSummary memory summary);
    function getMarketOption(uint256 marketId, uint256 optionIndex) external view returns (string memory label, string memory value);
    function getNextMarketId() external view returns (uint256);
    function getToken() external view returns (address);
    function getPlatformFeeBps() external view returns (uint16);
    function getGameMarketIds(string calldata gameId) external view returns (uint256[] memory);
    function getOptionSummaries(uint256 marketId) external view returns (PredictionMarketViewFacet.OptionSummary[] memory summaries);
    function getAdmin() external view returns (address);
    function isCancelled(uint256 marketId) external view returns (bool);
    function isPaused() external view returns (bool);
    function getLatestMarketId() external view returns (uint256 marketId);
}
