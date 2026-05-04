import hre from "hardhat";
import {
  parseMarketOptions,
  readDeploymentArtifact,
  resolveRuntimeNetworkName,
} from "./utils";

async function main() {
  const networkName = resolveRuntimeNetworkName();
  const deployment = readDeploymentArtifact(networkName);
  const diamondAddress = deployment.diamond;
  const marketQuestion = process.env.MARKET_QUESTION;
  const marketGameId = process.env.MARKET_GAME_ID || "today";
  const marketCategory = process.env.MARKET_CATEGORY || "eating-challenge";
  const marketCloseTime = process.env.MARKET_CLOSE_TIME ? Number(process.env.MARKET_CLOSE_TIME) : null;
  const marketOptionsRaw = process.env.MARKET_OPTIONS_JSON;
  const marketCreator = process.env.MARKET_CREATOR_ADDRESS || hre.ethers.ZeroAddress;
  const marketCreatorFeeBps = Number(process.env.MARKET_CREATOR_FEE_BPS || "0");

  if (!marketQuestion) {
    throw new Error("MARKET_QUESTION is required");
  }
  if (!marketOptionsRaw) {
    throw new Error("MARKET_OPTIONS_JSON is required");
  }
  if (marketCloseTime === null || !Number.isInteger(marketCloseTime) || marketCloseTime <= 0) {
    throw new Error("MARKET_CLOSE_TIME must be a unix timestamp in seconds");
  }
  if (!Number.isInteger(marketCreatorFeeBps) || marketCreatorFeeBps < 0 || marketCreatorFeeBps > 10000) {
    throw new Error("MARKET_CREATOR_FEE_BPS must be an integer between 0 and 10000");
  }

  const marketOptions = parseMarketOptions(marketOptionsRaw);

  const core = await hre.ethers.getContractAt("PredictionCoreFacet", diamondAddress);
  const view = await hre.ethers.getContractAt("PredictionMarketViewFacet", diamondAddress);

  const createMarketTx = marketCreator === hre.ethers.ZeroAddress
    ? await core.createMarket(marketGameId, marketQuestion, marketCategory, marketCloseTime, marketOptions)
    : await core.createMarketWithCreator(
        marketGameId,
        marketQuestion,
        marketCategory,
        marketCloseTime,
        marketOptions,
        marketCreator,
        marketCreatorFeeBps
      );

  const receipt = await createMarketTx.wait();
  const nextMarketId = Number(await view.getNextMarketId());
  if (nextMarketId <= 0) {
    throw new Error("MARKET_CREATION_NOT_REFLECTED");
  }
  const marketId = nextMarketId - 1;

  console.log("Market created");
  console.log(`txHash: ${receipt?.hash ?? createMarketTx.hash}`);
  console.log(`diamond: ${diamondAddress}`);
  console.log(`marketId: ${marketId}`);
  console.log(`marketQuestion: ${marketQuestion}`);
  console.log(`marketCloseTime: ${marketCloseTime}`);
  console.log(`artifact: deployedContracts/${networkName}.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
