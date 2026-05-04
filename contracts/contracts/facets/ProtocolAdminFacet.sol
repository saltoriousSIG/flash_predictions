// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IProtocolAdminFacet } from "../interfaces/IProtocolAdminFacet.sol";
import { LibMarket } from "../libraries/LibMarket.sol";

contract ProtocolAdminFacet is IProtocolAdminFacet {
    using SafeERC20 for IERC20;

    function setAdmin(address newAdmin) external {
        LibMarket.enforceIsAdmin();
        require(newAdmin != address(0), "INVALID_ADMIN");
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        address previousAdmin = ms.admin;
        ms.admin = newAdmin;
        emit AdminUpdated(previousAdmin, newAdmin);
    }

    function setPlatformFeeBps(uint16 newPlatformFeeBps) external {
        LibMarket.enforceIsAdmin();
        require(newPlatformFeeBps <= LibMarket.MAX_BPS, "INVALID_FEE");
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        uint16 previousFeeBps = ms.platformFeeBps;
        ms.platformFeeBps = newPlatformFeeBps;
        emit PlatformFeeUpdated(previousFeeBps, newPlatformFeeBps);
    }

    function withdrawFees(address to, uint256 amount) external {
        LibMarket.enforceIsAdmin();
        require(to != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "ZERO_AMOUNT");
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        require(ms.accumulatedFees >= amount, "INSUFFICIENT_FEES");
        ms.accumulatedFees -= amount;
        IERC20(ms.token).safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    function withdrawCreatorFees(address to, uint256 amount) external {
        require(to != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "ZERO_AMOUNT");
        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        require(ms.creatorFees[msg.sender] >= amount, "INSUFFICIENT_FEES");
        ms.creatorFees[msg.sender] -= amount;
        IERC20(ms.token).safeTransfer(to, amount);
        emit CreatorFeesWithdrawn(msg.sender, to, amount);
    }

    function accumulatedFees() external view returns (uint256) {
        return LibMarket.getStorage().accumulatedFees;
    }

    function creatorFees(address creator) external view returns (uint256) {
        return LibMarket.getStorage().creatorFees[creator];
    }
}
