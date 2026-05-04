// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { LibMarket } from "../libraries/LibMarket.sol";
import { LibPredictionStorage } from "../libraries/LibPredictionStorage.sol";

interface IPredictionCoreFacet {
    event MarketCreated(uint256 indexed marketId, string gameId);
    event MarketClosed(uint256 indexed marketId, uint256 closedAt);
    event PredictionPlaced(bytes32 indexed predictionId, uint256 indexed marketId, address indexed bettor, uint256 optionIndex, uint256 amount);
    event PredictionOutcomeFinalized(bytes32 indexed settlementId, uint256 indexed marketId, uint256 winningOptionIndex);
    event PredictionClaimed(bytes32 indexed predictionId, uint256 indexed marketId, address indexed bettor, uint256 payout, uint256 profit);
    event PredictionVoided(bytes32 indexed predictionId, uint256 indexed marketId, address indexed bettor, uint256 amount);
    event PredictionMarketEscrowClosed(uint256 indexed marketId, uint256 dustAmount);

    function createMarket(string calldata gameId, string calldata question, string calldata category, uint256 closeTime, LibMarket.Option[] calldata options) external returns (uint256 marketId);
    function createMarketWithCreator(string calldata gameId, string calldata question, string calldata category, uint256 closeTime, LibMarket.Option[] calldata options, address creator, uint16 creatorFeeBps) external returns (uint256 marketId);
    function closeMarket(uint256 marketId) external;
    function batchCloseMarkets(uint256[] calldata marketIds) external;
    function placePrediction(bytes32 predictionId, uint256 marketId, uint256 optionIndex, uint256 amount) external;
    function finalizePredictionOutcome(bytes32 settlementId, uint256 marketId, uint256 winningOptionIndex) external;
    function claimPrediction(bytes32 predictionId) external;
    function claimPredictions(uint256 marketId, bytes32[] calldata predictionIds) external;
    function voidPrediction(bytes32 predictionId) external;
    function voidPredictions(uint256 marketId, bytes32[] calldata predictionIds) external;
    function getPrediction(bytes32 predictionId) external view returns (LibPredictionStorage.Prediction memory prediction);
    function getMarketPredictionIds(uint256 marketId) external view returns (bytes32[] memory predictionIds);
    function getUserPredictionIds(address user) external view returns (bytes32[] memory predictionIds);
    function getMarketOutcome(uint256 marketId) external view returns (bool finalized, uint256 winningOptionIndex, uint256 totalPool, uint256 escrowRemaining);
}
