import hre, { ethers, run } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import type { BaseContract, BytesLike, ContractRunner, FunctionFragment } from "ethers";

export enum FacetCutAction {
  Add = 0,
  Replace = 1,
  Remove = 2,
}

function normalizeSelector(selector: BytesLike): string {
  return selector.toString().toLowerCase();
}

export const networkConfig: Record<string, { usdc: string }> = {
  base: { usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  baseSepolia: { usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
  hardhat: { usdc: "" },
};

export function getSelectors(contract: BaseContract, exclude: string[] = []): string[] {
  const selectors: string[] = [];
  const iface = contract.interface;

  iface.forEachFunction((fn: FunctionFragment) => {
    if (!exclude.includes(fn.name)) {
      selectors.push(iface.getFunction(fn.name)!.selector);
    }
  });

  return selectors;
}

export async function getSelectorsFromArtifact(
  contractName: string,
  existingSelectors: Array<BytesLike> = [],
  exclude: string[] = []
): Promise<string[]> {
  const artifact = await hre.artifacts.readArtifact(contractName);
  const iface = new ethers.Interface(artifact.abi);

  const existingSet = new Set(existingSelectors.map(normalizeSelector));
  const selectors: string[] = [];

  iface.forEachFunction((fn: FunctionFragment) => {
    if (exclude.includes(fn.name)) return;

    const selector = iface.getFunction(fn.name)?.selector;
    if (!selector) return;

    const normalized = normalizeSelector(selector);
    if (existingSet.has(normalized)) return;

    existingSet.add(normalized);
    selectors.push(selector);
    existingSelectors.push(selector);
  });

  return selectors;
}

export async function deployContract<T extends BaseContract>(
  name: string,
  args: unknown[] = [],
  signer?: ContractRunner
): Promise<T> {
  const factory = await ethers.getContractFactory(name, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ${name} deployed at ${address}`);
  return contract as unknown as T;
}

export async function verifyContract(
  address: string,
  constructorArguments: unknown[] = []
): Promise<boolean> {
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`  Verified ${address}`);
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Already Verified")) {
      console.log(`  Already verified: ${address}`);
      return true;
    }

    console.error(`  Verification failed for ${address}:`, message);
    return false;
  }
}

export type MarketOptionInput = {
  label: string;
  value: string;
};

export function parseMarketOptions(raw: string): MarketOptionInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MARKET_OPTIONS_JSON must be valid JSON");
  }

  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error("MARKET_OPTIONS_JSON must be an array with at least two options");
  }

  for (const option of parsed) {
    if (
      typeof option !== "object" ||
      option === null ||
      typeof (option as MarketOptionInput).label !== "string" ||
      typeof (option as MarketOptionInput).value !== "string"
    ) {
      throw new Error("Each market option must include string fields: label and value");
    }
  }

  return parsed as MarketOptionInput[];
}

export type DeploymentArtifact = {
  network: string;
  chainId: number;
  deployer: string;
  token: string;
  admin: string;
  platformFeeBps: number;
  diamond: string;
  facets: {
    predictionCoreFacet: string;
    predictionMarketViewFacet: string;
    protocolAdminFacet: string;
    protocolSafetyFacet: string;
  };
  deployedAt: string;
};

function deploymentDirectory(): string {
  return path.resolve(process.cwd(), "deployedContracts");
}

export function deploymentArtifactPath(networkName: string): string {
  return path.join(deploymentDirectory(), `${networkName}.json`);
}

export function writeDeploymentArtifact(networkName: string, artifact: DeploymentArtifact): string {
  const dir = deploymentDirectory();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const artifactPath = deploymentArtifactPath(networkName);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  return artifactPath;
}

export function readDeploymentArtifact(networkName: string): DeploymentArtifact {
  const artifactPath = deploymentArtifactPath(networkName);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Deployment artifact not found: ${artifactPath}`);
  }

  const raw = fs.readFileSync(artifactPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<DeploymentArtifact>;

  if (!parsed.diamond || typeof parsed.diamond !== "string") {
    throw new Error(`Invalid deployment artifact: missing diamond address in ${artifactPath}`);
  }

  return parsed as DeploymentArtifact;
}

export function resolveRuntimeNetworkName(): string {
  return process.env.DEPLOYMENT_NETWORK || hre.network.name;
}
