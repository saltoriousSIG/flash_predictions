// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPredictionCoreFacet } from "../interfaces/IPredictionCoreFacet.sol";
import { LibMarket } from "../libraries/LibMarket.sol";
import { LibPredictionStorage } from "../libraries/LibPredictionStorage.sol";

contract PredictionCoreFacet is IPredictionCoreFacet {
    using SafeERC20 for IERC20;

    function createMarket(string calldata gameId, string calldata question, string calldata category, uint256 closeTime, LibMarket.Option[] calldata options) external returns (uint256 marketId) {
        return _createMarket(gameId, question, category, closeTime, options, address(0), 0);
    }

    function createMarketWithCreator(string calldata gameId, string calldata question, string calldata category, uint256 closeTime, LibMarket.Option[] calldata options, address creator, uint16 creatorFeeBps) external returns (uint256 marketId) {
        return _createMarket(gameId, question, category, closeTime, options, creator, creatorFeeBps);
    }

    function closeMarket(uint256 marketId) external {
        LibMarket.enforceIsAdmin();
        _closeMarket(marketId);
    }

    function batchCloseMarkets(uint256[] calldata marketIds) external {
        LibMarket.enforceIsAdmin();
        for (uint256 i = 0; i < marketIds.length; i++) {
            _closeMarket(marketIds[i]);
        }
    }

    function placePrediction(bytes32 predictionId, uint256 marketId, uint256 optionIndex, uint256 amount) external {
        require(predictionId != bytes32(0), "INVALID_PREDICTION_ID");
        require(amount > 0, "ZERO_AMOUNT");
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.enforceNotPaused();

        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        LibMarket.Market storage market = ms.markets[marketId];
        require(!ms.cancelled[marketId], "MARKET_CANCELLED");
        require(!market.resolved, "MARKET_RESOLVED");
        require(!market.isClosed, "MARKET_CLOSED");
        require(block.timestamp < market.closeTime, "MARKET_ENTRY_CLOSED");
        require(optionIndex < market.options.length, "INVALID_OPTION_INDEX");

        LibPredictionStorage.Layout storage ps = LibPredictionStorage.layout();
        require(ps.predictions[predictionId].status == LibPredictionStorage.PredictionStatus.None, "PREDICTION_EXISTS");

        IERC20(ms.token).safeTransferFrom(msg.sender, address(this), amount);

        ps.predictions[predictionId] = LibPredictionStorage.Prediction({
            bettor: msg.sender,
            marketId: marketId,
            optionIndex: optionIndex,
            amount: amount,
            status: LibPredictionStorage.PredictionStatus.Active,
            createdAt: block.timestamp
        });

        ps.marketPredictionIds[marketId].push(predictionId);
        ps.userPredictionIds[msg.sender].push(predictionId);
        ps.marketTotalPool[marketId] += amount;
        ps.marketOptionPools[marketId][optionIndex] += amount;
        ps.marketEscrowRemaining[marketId] += amount;

        emit PredictionPlaced(predictionId, marketId, msg.sender, optionIndex, amount);
    }

    function finalizePredictionOutcome(bytes32 settlementId, uint256 marketId, uint256 winningOptionIndex) external {
        LibMarket.enforceIsAdmin();
        require(settlementId != bytes32(0), "INVALID_SETTLEMENT_ID");
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");

        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        LibMarket.Market storage market = ms.markets[marketId];
        require(!ms.cancelled[marketId], "MARKET_CANCELLED");
        require(!market.resolved, "MARKET_RESOLVED");
        require(winningOptionIndex < market.options.length, "INVALID_OPTION_INDEX");

        market.resolved = true;
        market.winningOptionIndex = winningOptionIndex;
        market.resolvedAt = block.timestamp;
        market.isClosed = true;
        market.closedAt = block.timestamp;

        emit PredictionOutcomeFinalized(settlementId, marketId, winningOptionIndex);
    }

    function claimPrediction(bytes32 predictionId) external {
        LibPredictionStorage.Prediction storage prediction = LibPredictionStorage.layout().predictions[predictionId];
        require(prediction.status == LibPredictionStorage.PredictionStatus.Active, "PREDICTION_NOT_ACTIVE");
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = predictionId;
        _claimPredictions(prediction.marketId, ids);
    }

    function claimPredictions(uint256 marketId, bytes32[] calldata predictionIds) external {
        require(predictionIds.length > 0, "EMPTY_PREDICTION_IDS");
        _claimPredictions(marketId, predictionIds);
    }

    function voidPrediction(bytes32 predictionId) external {
        LibPredictionStorage.Prediction storage prediction = LibPredictionStorage.layout().predictions[predictionId];
        require(prediction.status == LibPredictionStorage.PredictionStatus.Active, "PREDICTION_NOT_ACTIVE");
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = predictionId;
        _voidPredictions(prediction.marketId, ids);
    }

    function voidPredictions(uint256 marketId, bytes32[] calldata predictionIds) external {
        require(predictionIds.length > 0, "EMPTY_PREDICTION_IDS");
        _voidPredictions(marketId, predictionIds);
    }

    function getPrediction(bytes32 predictionId) external view returns (LibPredictionStorage.Prediction memory prediction) {
        return LibPredictionStorage.layout().predictions[predictionId];
    }

    function getMarketPredictionIds(uint256 marketId) external view returns (bytes32[] memory predictionIds) {
        return LibPredictionStorage.layout().marketPredictionIds[marketId];
    }

    function getUserPredictionIds(address user) external view returns (bytes32[] memory predictionIds) {
        return LibPredictionStorage.layout().userPredictionIds[user];
    }

    function getMarketOutcome(uint256 marketId) external view returns (bool finalized, uint256 winningOptionIndex, uint256 totalPool, uint256 escrowRemaining) {
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.Market storage market = LibMarket.getStorage().markets[marketId];
        LibPredictionStorage.Layout storage ps = LibPredictionStorage.layout();
        return (market.resolved, market.winningOptionIndex, ps.marketTotalPool[marketId], ps.marketEscrowRemaining[marketId]);
    }

    function _createMarket(string calldata gameId, string calldata question, string calldata category, uint256 closeTime, LibMarket.Option[] calldata options, address creator, uint16 creatorFeeBps) internal returns (uint256 marketId) {
        LibMarket.enforceIsAdmin();
        LibMarket.enforceNotPaused();
        require(options.length >= 2, "NEED_TWO_OPTIONS");
        require(creatorFeeBps <= LibMarket.MAX_BPS, "INVALID_CREATOR_FEE");
        require(creatorFeeBps == 0 || creator != address(0), "INVALID_CREATOR");
        require(closeTime > block.timestamp, "INVALID_CLOSE_TIME");

        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        marketId = ms.nextMarketId++;

        LibMarket.Market storage market = ms.markets[marketId];
        market.id = marketId;
        market.gameId = gameId;
        market.question = question;
        market.category = category;
        market.closeTime = closeTime;
        market.createdAt = block.timestamp;
        market.creator = creator;
        market.creatorFeeBps = creatorFeeBps;

        for (uint256 i = 0; i < options.length; i++) {
            market.options.push(options[i]);
        }

        ms.gameMarkets[gameId].push(marketId);
        emit MarketCreated(marketId, gameId);
    }

    function _closeMarket(uint256 marketId) internal {
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");
        LibMarket.Market storage market = LibMarket.getStorage().markets[marketId];
        require(!market.resolved, "MARKET_RESOLVED");
        require(!market.isClosed, "MARKET_CLOSED");

        market.isClosed = true;
        market.closedAt = block.timestamp;
        emit MarketClosed(marketId, market.closedAt);
    }

    function _claimPredictions(uint256 marketId, bytes32[] memory predictionIds) internal {
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        require(!ms.cancelled[marketId], "MARKET_CANCELLED");
        require(LibMarket.marketExists(marketId), "MARKET_NOT_FOUND");

        LibMarket.Market storage market = ms.markets[marketId];
        require(market.resolved, "OUTCOME_NOT_FINALIZED");

        LibPredictionStorage.Layout storage ps = LibPredictionStorage.layout();
        uint256 winnerPool = ps.marketOptionPools[marketId][market.winningOptionIndex];
        uint256 loserPool = ps.marketTotalPool[marketId] - winnerPool;
        uint256 platformFee = (loserPool * ms.platformFeeBps) / LibMarket.MAX_BPS;
        uint256 loserPoolAfterPlatformFee = loserPool - platformFee;
        uint256 creatorFee = market.creator == address(0) ? 0 : (loserPool * market.creatorFeeBps) / LibMarket.MAX_BPS;
        if (creatorFee > loserPoolAfterPlatformFee) {
            creatorFee = loserPoolAfterPlatformFee;
        }
        uint256 distributableLoserPool = loserPoolAfterPlatformFee - creatorFee;

        uint256 totalPayout;
        for (uint256 i = 0; i < predictionIds.length; i++) {
            totalPayout += _claimSinglePrediction(ps, predictionIds[i], marketId, msg.sender, market.winningOptionIndex, winnerPool, distributableLoserPool);
        }

        if (totalPayout > 0) {
            ps.marketEscrowRemaining[marketId] -= totalPayout;
            IERC20(ms.token).safeTransfer(msg.sender, totalPayout);
        }

        _closeMarketEscrowIfComplete(ms, ps, marketId, creatorFee, market.creator);
    }

    function _claimSinglePrediction(LibPredictionStorage.Layout storage ps, bytes32 predictionId, uint256 marketId, address bettor, uint256 winningOptionIndex, uint256 winnerPool, uint256 distributableLoserPool) internal returns (uint256 payout) {
        LibPredictionStorage.Prediction storage prediction = ps.predictions[predictionId];
        require(prediction.status == LibPredictionStorage.PredictionStatus.Active, "PREDICTION_NOT_ACTIVE");
        require(prediction.marketId == marketId, "PREDICTION_MARKET_MISMATCH");
        require(prediction.bettor == bettor, "NOT_PREDICTION_OWNER");

        uint256 profit;
        if (prediction.optionIndex == winningOptionIndex) {
            require(winnerPool > 0, "NO_WINNER_POOL");
            profit = (prediction.amount * distributableLoserPool) / winnerPool;
            payout = prediction.amount + profit;
        }

        prediction.status = LibPredictionStorage.PredictionStatus.Settled;
        ps.marketSettledCount[marketId] += 1;
        emit PredictionClaimed(predictionId, marketId, bettor, payout, profit);
    }

    function _voidPredictions(uint256 marketId, bytes32[] memory predictionIds) internal {
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        require(ms.cancelled[marketId], "MARKET_NOT_CANCELLED");
        LibPredictionStorage.Layout storage ps = LibPredictionStorage.layout();

        uint256 totalRefund;
        for (uint256 i = 0; i < predictionIds.length; i++) {
            LibPredictionStorage.Prediction storage prediction = ps.predictions[predictionIds[i]];
            require(prediction.status == LibPredictionStorage.PredictionStatus.Active, "PREDICTION_NOT_ACTIVE");
            require(prediction.marketId == marketId, "PREDICTION_MARKET_MISMATCH");
            require(prediction.bettor == msg.sender, "NOT_PREDICTION_OWNER");

            uint256 amount = prediction.amount;
            prediction.status = LibPredictionStorage.PredictionStatus.Cancelled;
            ps.marketSettledCount[marketId] += 1;
            totalRefund += amount;
            emit PredictionVoided(predictionIds[i], marketId, msg.sender, amount);
        }

        ps.marketEscrowRemaining[marketId] -= totalRefund;
        IERC20(ms.token).safeTransfer(msg.sender, totalRefund);
        _closeMarketEscrowIfComplete(ms, ps, marketId, 0, address(0));
    }

    function _closeMarketEscrowIfComplete(LibMarket.MarketStorage storage ms, LibPredictionStorage.Layout storage ps, uint256 marketId, uint256 creatorFee, address creator) internal {
        uint256 totalPredictions = ps.marketPredictionIds[marketId].length;
        if (totalPredictions == 0 || ps.marketSettledCount[marketId] != totalPredictions) {
            return;
        }

        uint256 remaining = ps.marketEscrowRemaining[marketId];
        ps.marketEscrowRemaining[marketId] = 0;

        if (remaining > 0) {
            uint256 creatorShare = creator == address(0) ? 0 : creatorFee;
            if (creatorShare > remaining) {
                creatorShare = remaining;
            }

            ms.creatorFees[creator] += creatorShare;
            ms.accumulatedFees += remaining - creatorShare;
        }

        emit PredictionMarketEscrowClosed(marketId, remaining);
    }
}
