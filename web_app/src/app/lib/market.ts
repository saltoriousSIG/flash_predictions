import { createPublicClient, formatUnits, http } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, CONTRACT_ADDRESS } from "./config";

const viewAbi = [
  {
    inputs: [],
    name: "getLatestMarketId",
    outputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "marketId", type: "uint256" },
          { internalType: "string", name: "gameId", type: "string" },
          { internalType: "string", name: "question", type: "string" },
          { internalType: "string", name: "category", type: "string" },
          { internalType: "uint256", name: "totalPool", type: "uint256" },
          { internalType: "uint256", name: "closeTime", type: "uint256" },
          { internalType: "bool", name: "resolved", type: "bool" },
          { internalType: "uint256", name: "winningOptionIndex", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "resolvedAt", type: "uint256" },
          { internalType: "uint256", name: "optionCount", type: "uint256" },
          { internalType: "bool", name: "isClosed", type: "bool" },
          { internalType: "uint256", name: "closedAt", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "uint16", name: "creatorFeeBps", type: "uint16" },
        ],
        internalType: "struct PredictionMarketViewFacet.MarketSummary",
        name: "summary",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    name: "getOptionSummaries",
    outputs: [
      {
        components: [
          { internalType: "string", name: "label", type: "string" },
          { internalType: "string", name: "value", type: "string" },
          { internalType: "uint256", name: "pool", type: "uint256" },
          { internalType: "uint256", name: "bettorCount", type: "uint256" },
        ],
        internalType: "struct PredictionMarketViewFacet.OptionSummary[]",
        name: "summaries",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    name: "isCancelled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getToken",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPlatformFeeBps",
    outputs: [{ internalType: "uint16", name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const erc20MetadataAbi = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const client = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URL),
});

type MarketSummary = {
  marketId: bigint;
  gameId: string;
  question: string;
  category: string;
  totalPool: bigint;
  closeTime: bigint;
  resolved: boolean;
  winningOptionIndex: bigint;
  createdAt: bigint;
  resolvedAt: bigint;
  optionCount: bigint;
  isClosed: boolean;
  closedAt: bigint;
  creator: `0x${string}`;
  creatorFeeBps: number;
};

type OptionSummary = {
  label: string;
  value: string;
  pool: bigint;
  bettorCount: bigint;
};

export async function getLatestMarketSnapshot() {
  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  const address = CONTRACT_ADDRESS as `0x${string}`;
  let marketId: bigint;
  try {
    marketId = await client.readContract({ address, abi: viewAbi, functionName: "getLatestMarketId" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("NO_MARKETS")) {
      return null;
    }
    throw error;
  }
  const market = (await client.readContract({
    address,
    abi: viewAbi,
    functionName: "getMarket",
    args: [marketId],
  })) as MarketSummary;
  const optionSummaries = (await client.readContract({
    address,
    abi: viewAbi,
    functionName: "getOptionSummaries",
    args: [marketId],
  })) as OptionSummary[];
  const cancelled = await client.readContract({ address, abi: viewAbi, functionName: "isCancelled", args: [marketId] });
  const tokenAddress = await client.readContract({ address, abi: viewAbi, functionName: "getToken" });
  const platformFeeBps = await client.readContract({ address, abi: viewAbi, functionName: "getPlatformFeeBps" });
  const token = tokenAddress as `0x${string}`;
  const [tokenDecimals, tokenSymbol] = await Promise.all([
    client.readContract({ address: token, abi: erc20MetadataAbi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20MetadataAbi, functionName: "symbol" }),
  ]);

  return {
    marketId: Number(market.marketId),
    gameId: market.gameId,
    question: market.question,
    category: market.category,
    closeTime: Number(market.closeTime),
    resolved: market.resolved,
    isClosed: market.isClosed,
    cancelled,
    creator: market.creator,
    creatorFeeBps: market.creatorFeeBps,
    platformFeeBps: Number(platformFeeBps),
    winningOptionIndex: Number(market.winningOptionIndex),
    tokenAddress: token,
    tokenDecimals: Number(tokenDecimals),
    tokenSymbol,
    totalPoolRaw: market.totalPool.toString(),
    totalPoolDisplay: formatUnits(market.totalPool, Number(tokenDecimals)),
    options: optionSummaries.map((option, index) => ({
      index,
      label: option.label,
      value: option.value,
      poolRaw: option.pool.toString(),
      poolDisplay: formatUnits(option.pool, Number(tokenDecimals)),
      bettorCount: Number(option.bettorCount),
    })),
  };
}

export type MarketSnapshot = Awaited<ReturnType<typeof getLatestMarketSnapshot>>;
