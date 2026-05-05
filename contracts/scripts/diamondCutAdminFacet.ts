import hre from "hardhat";
import {
  FacetCutAction,
  deployContract,
  readDeploymentArtifact,
  resolveRuntimeNetworkName,
} from "./utils";

async function main() {
  const networkName = resolveRuntimeNetworkName();
  const deployment = readDeploymentArtifact(networkName);
  const diamondAddress = deployment.diamond;

  const [deployerSigner] = await hre.ethers.getSigners();
  const deployer = new hre.ethers.NonceManager(deployerSigner);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        const shouldRetry = message.includes("nonce too low") || message.includes("replacement transaction underpriced") || message.includes("in-flight transaction limit reached");
        if (!shouldRetry || attempt === 6) {
          throw error;
        }
        deployer.reset();
        const waitMs = 5000 * attempt;
        console.log(`  transient tx error (${attempt}/6), retrying in ${waitMs}ms`);
        await sleep(waitMs);
      }
    }
    throw lastError;
  };

  const protocolAdminFacet = await withRetry(() => deployContract("ProtocolAdminFacet", [], deployer));
  const protocolAdminFacetAddress = await protocolAdminFacet.getAddress();

  const adminSelectors = [
    protocolAdminFacet.interface.getFunction("extendMarketCloseTime")?.selector,
  ].filter((value): value is string => typeof value === "string");

  if (adminSelectors.length === 0) {
    console.log("No new ProtocolAdminFacet selectors to add.");
    return;
  }

  const diamondCut = await hre.ethers.getContractAt("IERC2535DiamondCut", diamondAddress, deployer);
  const tx = await withRetry(() => diamondCut.diamondCut(
    [{ target: protocolAdminFacetAddress, action: FacetCutAction.Add, selectors: adminSelectors }],
    hre.ethers.ZeroAddress,
    "0x"
  ));
  await tx.wait();

  console.log("ProtocolAdminFacet diamond cut complete");
  console.log(`diamond: ${diamondAddress}`);
  console.log(`newProtocolAdminFacet: ${protocolAdminFacetAddress}`);
  console.log(`addedSelectors: ${adminSelectors.length}`);
  console.log(`txHash: ${tx.hash}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
