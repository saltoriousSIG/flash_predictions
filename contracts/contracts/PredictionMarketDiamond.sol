// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { SolidstateDiamondProxy } from "@solidstate/contracts/proxy/diamond/SolidstateDiamondProxy.sol";
import { LibMarket } from "./libraries/LibMarket.sol";

contract PredictionMarketDiamond is SolidstateDiamondProxy {
    constructor(address token, uint16 platformFeeBps, address admin) {
        require(token != address(0), "INVALID_TOKEN");
        require(admin != address(0), "INVALID_ADMIN");
        require(platformFeeBps <= LibMarket.MAX_BPS, "INVALID_FEE");

        LibMarket.MarketStorage storage ms = LibMarket.getStorage();
        ms.token = token;
        ms.platformFeeBps = platformFeeBps;
        ms.admin = admin;
    }
}
