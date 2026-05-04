import hre from "hardhat";
import {
  FacetCutAction,
  deployContract,
  getSelectors,
  resolveRuntimeNetworkName,
  writeDeploymentArtifact,
} from "./utils";

const EXCLUDED_FUNCTION_NAMES = ["owner", "transferOwnership", "isPaused", "isCancelled"];

async function main() {
  const [deployerSigner] = await hre.ethers.getSigners();
  const deployer = new hre.ethers.NonceManager(deployerSigner);
  const deployerAddress = await deployer.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const networkName = resolveRuntimeNetworkName();
  const token = process.env.TOKEN_ADDRESS;
  const admin = process.env.ADMIN_ADDRESS || deployerAddress;
  const platformFeeBps = Number(process.env.PLATFORM_FEE_BPS || "1000");

  if (!token) {
    throw new Error("TOKEN_ADDRESS is required");
  }

  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10000) {
    throw new Error("PLATFORM_FEE_BPS must be an integer between 0 and 10000");
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const deployWithRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        const shouldRetry = message.includes("nonce too low") || message.includes("in-flight transaction limit reached");

        if (!shouldRetry || attempt === 6) {
          throw error;
        }

        deployer.reset();
        const waitMs = 5000 * attempt;
        console.log(`  transient deployment error (${attempt}/6), retrying in ${waitMs}ms`);
        await sleep(waitMs);
      }
    }

    throw lastError;
  };

  const coreFacet = await deployWithRetry(() => deployContract("PredictionCoreFacet", [], deployer));
  const viewFacet = await deployWithRetry(() => deployContract("PredictionMarketViewFacet", [], deployer));
  const adminFacet = await deployWithRetry(() => deployContract("ProtocolAdminFacet", [], deployer));
  const safetyFacet = await deployWithRetry(() => deployContract("ProtocolSafetyFacet", [], deployer));
  const diamond = await deployWithRetry(() => deployContract("PredictionMarketDiamond", [token, platformFeeBps, admin], deployer));

  const diamondAddress = await diamond.getAddress();
  const cuts = [
    { target: await coreFacet.getAddress(), action: FacetCutAction.Add, selectors: getSelectors(coreFacet) },
    { target: await viewFacet.getAddress(), action: FacetCutAction.Add, selectors: getSelectors(viewFacet) },
    { target: await adminFacet.getAddress(), action: FacetCutAction.Add, selectors: getSelectors(adminFacet) },
    {
      target: await safetyFacet.getAddress(),
      action: FacetCutAction.Add,
      selectors: getSelectors(safetyFacet, EXCLUDED_FUNCTION_NAMES),
    },
  ];

  const diamondCut = await hre.ethers.getContractAt("IERC2535DiamondCut", diamondAddress, deployer);
  const tx = await deployWithRetry(() => diamondCut.diamondCut(cuts, hre.ethers.ZeroAddress, "0x"));
  await tx.wait();

  const artifactPath = writeDeploymentArtifact(networkName, {
    network: networkName,
    chainId: Number(network.chainId),
    deployer: deployerAddress,
    token,
    admin,
    platformFeeBps,
    diamond: diamondAddress,
    facets: {
      predictionCoreFacet: await coreFacet.getAddress(),
      predictionMarketViewFacet: await viewFacet.getAddress(),
      protocolAdminFacet: await adminFacet.getAddress(),
      protocolSafetyFacet: await safetyFacet.getAddress(),
    },
    deployedAt: new Date().toISOString(),
  });

  console.log("Prediction market diamond deployed");
  console.log(`deployer: ${deployerAddress}`);
  console.log(`token: ${token}`);
  console.log(`admin: ${admin}`);
  console.log(`platformFeeBps: ${platformFeeBps}`);
  console.log(`diamond: ${diamondAddress}`);
  console.log(`predictionCoreFacet: ${await coreFacet.getAddress()}`);
  console.log(`predictionMarketViewFacet: ${await viewFacet.getAddress()}`);
  console.log(`protocolAdminFacet: ${await adminFacet.getAddress()}`);
  console.log(`protocolSafetyFacet: ${await safetyFacet.getAddress()}`);
  console.log(`artifact: ${artifactPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
