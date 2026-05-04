// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library LibPredictionStorage {
    bytes32 internal constant STORAGE_POSITION = keccak256("fattybuthappy.prediction.storage.v1");

    enum PredictionStatus {
        None,
        Active,
        Settled,
        Cancelled
    }

    struct Prediction {
        address bettor;
        uint256 marketId;
        uint256 optionIndex;
        uint256 amount;
        PredictionStatus status;
        uint256 createdAt;
    }

    struct Layout {
        mapping(bytes32 => Prediction) predictions;
        mapping(uint256 => bytes32[]) marketPredictionIds;
        mapping(address => bytes32[]) userPredictionIds;
        mapping(uint256 => uint256) marketTotalPool;
        mapping(uint256 => mapping(uint256 => uint256)) marketOptionPools;
        mapping(uint256 => uint256) marketSettledCount;
        mapping(uint256 => uint256) marketEscrowRemaining;
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_POSITION;
        assembly {
            l.slot := slot
        }
    }
}
