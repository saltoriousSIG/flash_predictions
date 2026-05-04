"use client";

import { useMemo, useState } from "react";
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
} from "viem";
import { base } from "viem/chains";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { BASE_RPC_URL } from "../lib/config";
import { useFrameSDK } from "../../providers/FrameSDKProvider";

type MarketOption = {
  index: number;
  label: string;
  poolRaw: string;
};

type ClaimablePrediction = {
  id: `0x${string}`;
  optionIndex: number;
  amountRaw: bigint;
  amountDisplay: string;
  payoutRaw: bigint;
  payoutDisplay: string;
  actionLabel: string;
};

type ClaimMarketCardProps = {
  marketId: number;
  options: MarketOption[];
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  contractAddress: string;
  totalPoolRaw: string;
  resolved: boolean;
  cancelled: boolean;
  winningOptionIndex: number;
  creator: `0x${string}`;
  creatorFeeBps: number;
  platformFeeBps: number;
};

const predictionCoreAbi = [
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "getUserPredictionIds",
    outputs: [{ internalType: "bytes32[]", name: "predictionIds", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "predictionId", type: "bytes32" }],
    name: "getPrediction",
    outputs: [
      {
        components: [
          { internalType: "address", name: "bettor", type: "address" },
          { internalType: "uint256", name: "marketId", type: "uint256" },
          { internalType: "uint256", name: "optionIndex", type: "uint256" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint8", name: "status", type: "uint8" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
        ],
        internalType: "struct LibPredictionStorage.Prediction",
        name: "prediction",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "predictionId", type: "bytes32" }],
    name: "claimPrediction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "predictionId", type: "bytes32" }],
    name: "voidPrediction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });
const ZERO = BigInt(0);
const BPS_DENOMINATOR = BigInt(10000);

function computeResolvedPayout(
  amount: bigint,
  optionIndex: number,
  winningOptionIndex: number,
  winnerPool: bigint,
  distributableLoserPool: bigint
) {
  if (optionIndex !== winningOptionIndex || winnerPool <= ZERO) {
    return ZERO;
  }
  return amount + (amount * distributableLoserPool) / winnerPool;
}

export function ClaimMarketCard({
  marketId,
  options,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  contractAddress,
  totalPoolRaw,
  resolved,
  cancelled,
  winningOptionIndex,
  creator,
  creatorFeeBps,
  platformFeeBps,
}: ClaimMarketCardProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState("Connect Farcaster wallet to load your claimable balance.");
  const [claims, setClaims] = useState<ClaimablePrediction[]>([]);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { context, isLoaded } = useFrameSDK();
  const isInFarcasterMiniApp = !!context?.user?.fid;
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
  const openInFarcasterUrl = `${appBaseUrl}/snap`;

  const marketFinalized = cancelled || resolved;

  const claimableTotal = useMemo(
    () => claims.reduce((acc, item) => acc + item.payoutRaw, ZERO),
    [claims]
  );

  async function connectWallet() {
    if (!connectors.length) {
      setStatus("Farcaster wallet connector unavailable. Open inside Farcaster mini app.");
      return;
    }

    const farcasterConnector = connectors.find((connector) =>
      connector.id.toLowerCase().includes("farcaster")
    ) ?? connectors[0];

    let connectedAddress: string | undefined;
    try {
      const result = await connectAsync({ connector: farcasterConnector });
      connectedAddress = result.accounts?.[0];
    } catch {
      setStatus("Unable to connect Farcaster wallet. Try again in the mini app.");
      return;
    }

    const activeAddress = connectedAddress || address;
    if (!activeAddress) {
      setStatus("Wallet connection failed.");
      return;
    }

    setStatus("Wallet connected. Checking claimable balance...");
    await refreshClaims(activeAddress);
  }

  async function refreshClaims(address: string) {
    if (!marketFinalized) {
      setClaims([]);
      setStatus("Market is not finalized yet. Claims open after resolve/cancel.");
      return;
    }

    try {
      const predictionIds = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: predictionCoreAbi,
        functionName: "getUserPredictionIds",
        args: [address as `0x${string}`],
      });

      const winnerPool = BigInt(options[winningOptionIndex]?.poolRaw ?? "0");
      const totalPool = BigInt(totalPoolRaw);
      const loserPool = totalPool > winnerPool ? totalPool - winnerPool : ZERO;
      const platformFee = (loserPool * BigInt(platformFeeBps)) / BPS_DENOMINATOR;
      const loserAfterPlatform = loserPool > platformFee ? loserPool - platformFee : ZERO;
      const creatorEnabled = creator.toLowerCase() !== "0x0000000000000000000000000000000000000000";
      const rawCreatorFee = creatorEnabled ? (loserPool * BigInt(creatorFeeBps)) / BPS_DENOMINATOR : ZERO;
      const creatorFee = rawCreatorFee > loserAfterPlatform ? loserAfterPlatform : rawCreatorFee;
      const distributableLoserPool = loserAfterPlatform > creatorFee ? loserAfterPlatform - creatorFee : ZERO;

      const claimable: ClaimablePrediction[] = [];
      for (const id of predictionIds) {
        const prediction = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: predictionCoreAbi,
          functionName: "getPrediction",
          args: [id],
        });

        const predictionMarketId = Number(prediction.marketId);
        const predictionStatus = Number(prediction.status);
        if (predictionMarketId !== marketId || predictionStatus !== 1) {
          continue;
        }

        const amountRaw = prediction.amount;
        const optionIndex = Number(prediction.optionIndex);
        const payoutRaw = cancelled
          ? amountRaw
          : computeResolvedPayout(amountRaw, optionIndex, winningOptionIndex, winnerPool, distributableLoserPool);

        if (payoutRaw <= ZERO) {
          continue;
        }

        claimable.push({
          id,
          optionIndex,
          amountRaw,
          amountDisplay: formatUnits(amountRaw, tokenDecimals),
          payoutRaw,
          payoutDisplay: formatUnits(payoutRaw, tokenDecimals),
          actionLabel: cancelled ? "Refund" : "Claim",
        });
      }

      setClaims(claimable);

      if (!claimable.length) {
        setStatus("No claimable balance found for this wallet.");
      } else {
        setStatus(`Found ${claimable.length} claimable prediction${claimable.length > 1 ? "s" : ""}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed reading claimable predictions.";
      setStatus(message);
    }
  }

  async function claimPrediction(predictionId: `0x${string}`) {
    if (!isConnected || !address) {
      setStatus("Connect Farcaster wallet first.");
      return;
    }
    if (!walletClient) {
      setStatus("Farcaster wallet not ready yet. Please try again.");
      return;
    }

    setIsWorking(true);
    try {
      const functionName = cancelled ? "voidPrediction" : "claimPrediction";
      const txHash = await walletClient.sendTransaction({
        account: address as `0x${string}`,
        to: contractAddress as `0x${string}`,
        data: encodeFunctionData({ abi: predictionCoreAbi, functionName, args: [predictionId] }),
      });

      setStatus(`${cancelled ? "Refund" : "Claim"} submitted: ${txHash}`);
      await refreshClaims(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claim transaction failed.";
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="rounded-3xl border border-fuchsia-300/30 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(217,70,239,0.12),0_25px_55px_-36px_rgba(232,121,249,0.65)] sm:p-5">
      <h2 className="text-lg font-semibold text-fuchsia-100">Claim Center</h2>
      <p className="mt-2 text-sm text-cyan-50/80">We scan your connected wallet and show prediction payouts available to claim.</p>

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-3">
        <p className="text-xs uppercase tracking-wide text-cyan-300/80">Claimable Total</p>
        <p className="mt-1 text-2xl font-semibold text-cyan-100">{formatUnits(claimableTotal, tokenDecimals)} {tokenSymbol}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {!isInFarcasterMiniApp && isLoaded ? (
          <a
            href={openInFarcasterUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10"
          >
            Open in Farcaster
          </a>
        ) : (
          <>
            <button
              type="button"
              onClick={connectWallet}
              className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10"
              disabled={isWorking || isConnecting}
            >
              {address ? `Connected ${address.slice(0, 6)}...${address.slice(-4)}` : isConnecting ? "Connecting..." : "Connect Farcaster Wallet"}
            </button>
            <button
              type="button"
              onClick={() => address && refreshClaims(address)}
              className="rounded-full border border-fuchsia-300/50 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-300/15 disabled:opacity-60"
              disabled={isWorking || !isConnected || !address}
            >
              Refresh Claims
            </button>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        {claims.map((claim) => (
          <div key={claim.id} className="rounded-xl border border-cyan-400/20 bg-slate-900/80 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-100">Option: {options[claim.optionIndex]?.label ?? `#${claim.optionIndex}`}</p>
                <p className="text-xs text-cyan-200/85">Stake: {claim.amountDisplay} {tokenSymbol}</p>
                <p className="text-xs text-fuchsia-200/90">Available: {claim.payoutDisplay} {tokenSymbol}</p>
              </div>
              <button
                type="button"
                onClick={() => claimPrediction(claim.id)}
                className="rounded-full bg-fuchsia-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-60"
                disabled={isWorking}
              >
                {claim.actionLabel}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/80 px-3 py-2 text-xs text-cyan-50/85">{status}</p>
      <p className="mt-2 text-xs text-cyan-100/75">Token: {tokenAddress}</p>
    </section>
  );
}
