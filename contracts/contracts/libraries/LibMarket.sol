// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library LibMarket {
    uint16 internal constant MAX_BPS = 10_000;
    bytes32 internal constant STORAGE_POSITION = keccak256("fattybuthappy.prediction.market.storage.v1");

    struct Option {
        string label;
        string value;
    }

    struct Market {
        uint256 id;
        string gameId;
        string question;
        string category;
        Option[] options;
        uint256 closeTime;
        bool resolved;
        uint256 winningOptionIndex;
        uint256 createdAt;
        uint256 resolvedAt;
        bool isClosed;
        uint256 closedAt;
        address creator;
        uint16 creatorFeeBps;
    }

    struct MarketStorage {
        mapping(uint256 => Market) markets;
        mapping(string => uint256[]) gameMarkets;
        mapping(uint256 => bool) cancelled;
        uint256 nextMarketId;
        address token;
        uint16 platformFeeBps;
        uint256 accumulatedFees;
        mapping(address => uint256) creatorFees;
        address admin;
        bool paused;
    }

    function getStorage() internal pure returns (MarketStorage storage ms) {
        bytes32 position = STORAGE_POSITION;
        assembly {
            ms.slot := position
        }
    }

    function marketExists(uint256 marketId) internal view returns (bool) {
        return marketId < getStorage().nextMarketId;
    }

    function enforceIsAdmin() internal view {
        require(msg.sender == getStorage().admin, "NOT_ADMIN");
    }

    function enforceNotPaused() internal view {
        require(!getStorage().paused, "PAUSED");
    }
}
