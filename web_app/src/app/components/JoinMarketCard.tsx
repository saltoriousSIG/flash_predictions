"use client";

import { useEffect, useMemo, useState } from "react";
import {
  encodeFunctionData,
  erc20Abi,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { useFrameSDK } from "../../providers/FrameSDKProvider";

type Option = {
  index: number;
  label: string;
  poolDisplay: string;
  bettorCount: number;
};

type JoinMarketCardProps = {
  marketId: number;
  options: Option[];
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  contractAddress: string;
  closeTime: number;
};

const predictionCoreAbi = [
  {
    inputs: [
      { internalType: "bytes32", name: "predictionId", type: "bytes32" },
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "uint256", name: "optionIndex", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "placePrediction",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

function makePredictionId(address: string, marketId: number, optionIndex: number) {
  const entropy = `${address}-${marketId}-${optionIndex}-${Date.now()}-${Math.random()}`;
  return keccak256(stringToHex(entropy));
}

export function JoinMarketCard({
  marketId,
  options,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  contractAddress,
  closeTime,
}: JoinMarketCardProps) {
  const [selectedOption, setSelectedOption] = useState<number>(
    options[0]?.index ?? 0
  );
  const [amount, setAmount] = useState("10");
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<string>("Connect Farcaster wallet to join this market.");
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { context, isLoaded } = useFrameSDK();
  const isInFarcasterMiniApp = !!context?.user?.fid;
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
  const openInFarcasterUrl = `${appBaseUrl}/snap`;

  const marketIsClosed = useMemo(() => Date.now() >= closeTime * 1000, [closeTime]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const optionFromQuery = Number(params.get("option"));
    if (Number.isInteger(optionFromQuery) && options.some((option) => option.index === optionFromQuery)) {
      setSelectedOption(optionFromQuery);
    }
  }, [options]);

  useEffect(() => {
    if (isConnected && address) {
      setStatus("Farcaster wallet connected. Approve and submit your prediction.");
    }
  }, [isConnected, address]);

  async function connectWallet() {
    if (!connectors.length) {
      setStatus("Farcaster wallet connector unavailable. Open inside Farcaster mini app.");
      return;
    }

    const farcasterConnector = connectors.find((connector) =>
      connector.id.toLowerCase().includes("farcaster")
    ) ?? connectors[0];

    try {
      await connectAsync({ connector: farcasterConnector });
    } catch {
      setStatus("Unable to connect Farcaster wallet. Try again in the mini app.");
      return;
    }
  }

  async function approveAndJoin() {
    if (marketIsClosed) {
      setStatus("Market is closed. New predictions are disabled.");
      return;
    }
    if (!isConnected || !address) {
      setStatus("Connect Farcaster wallet first.");
      return;
    }
    if (!walletClient) {
      setStatus("Farcaster wallet not ready yet. Please try again.");
      return;
    }

    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount, tokenDecimals);
    } catch {
      setStatus("Invalid amount format.");
      return;
    }

    if (parsedAmount <= BigInt(0)) {
      setStatus("Amount must be greater than zero.");
      return;
    }

    setIsWorking(true);
    try {
      setStatus(`Submitting ${tokenSymbol} approval...`);
      const approveTxHash = await walletClient.sendTransaction({
        account: address as `0x${string}`,
        to: tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [contractAddress as `0x${string}`, parsedAmount],
        }),
      });

      setStatus(`Approval sent: ${approveTxHash}. Sending prediction...`);

      const predictionId = makePredictionId(address, marketId, selectedOption);
      const placeTxHash = await walletClient.sendTransaction({
        account: address as `0x${string}`,
        to: contractAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: predictionCoreAbi,
          functionName: "placePrediction",
          args: [predictionId, BigInt(marketId), BigInt(selectedOption), parsedAmount],
        }),
      });

      setStatus(`Prediction submitted: ${placeTxHash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transaction failed";
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="rounded-3xl border border-fuchsia-300/30 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(217,70,239,0.12),0_25px_55px_-36px_rgba(232,121,249,0.65)] sm:p-5">
      <h2 className="text-lg font-semibold text-fuchsia-100">Join Market</h2>
      <p className="mt-2 text-sm text-cyan-50/80">Choose an option, enter your amount, then approve and place your onchain prediction.</p>

      <div className="mt-4 grid gap-2">
        {options.map((option) => (
          <button
            key={option.index}
            type="button"
            onClick={() => setSelectedOption(option.index)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              selectedOption === option.index
                ? "border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-100"
                : "border-cyan-400/20 bg-slate-900/80 text-cyan-50 hover:bg-slate-900"
            }`}
          >
            <span className="block font-semibold">{option.label}</span>
            <span className="block text-xs uppercase tracking-wide text-cyan-300/80">Pool: {option.poolDisplay} {tokenSymbol} · {option.bettorCount} bettors</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-cyan-50/80">
        Contract address: <span className="font-mono text-xs text-cyan-200">{contractAddress}</span>
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-full rounded-xl border border-cyan-400/25 bg-slate-900/80 px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-300"
          placeholder={`Amount in ${tokenSymbol}`}
          inputMode="decimal"
        />
        <span className="text-sm font-medium text-cyan-200">{tokenSymbol}</span>
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
              onClick={approveAndJoin}
              className="rounded-full bg-fuchsia-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-60"
              disabled={isWorking || !isConnected || !address || !walletClient || marketIsClosed}
            >
              {marketIsClosed ? "Market Closed" : isWorking ? "Submitting..." : `Approve + Join (${tokenSymbol})`}
            </button>
          </>
        )}
      </div>

      <p className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/80 px-3 py-2 text-xs text-cyan-50/85">{status}</p>
    </section>
  );
}
