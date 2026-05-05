import hre from "hardhat";
import { readDeploymentArtifact, resolveRuntimeNetworkName } from "./utils";

const protocolAdminAbi = [
  {
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "uint256", name: "newCloseTime", type: "uint256" },
    ],
    name: "extendMarketCloseTime",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function main() {
  const marketIdRaw = process.env.MARKET_ID;
  const newCloseTimeRaw = process.env.NEW_CLOSE_TIME;

  if (!marketIdRaw) {
    throw new Error("MARKET_ID is required");
  }
  if (!newCloseTimeRaw) {
    throw new Error("NEW_CLOSE_TIME is required");
  }

  const marketId = BigInt(marketIdRaw);
  const newCloseTime = BigInt(newCloseTimeRaw);

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (newCloseTime <= now) {
    throw new Error("NEW_CLOSE_TIME must be in the future");
  }

  const networkName = resolveRuntimeNetworkName();
  const deployment = readDeploymentArtifact(networkName);

  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(deployment.diamond, protocolAdminAbi, signer);

  const tx = await contract.extendMarketCloseTime(marketId, newCloseTime);
  await tx.wait();

  console.log("Market close time extended");
  console.log(`diamond: ${deployment.diamond}`);
  console.log(`marketId: ${marketId.toString()}`);
  console.log(`newCloseTime: ${newCloseTime.toString()}`);
  console.log(`txHash: ${tx.hash}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
