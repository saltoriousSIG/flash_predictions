"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import { base } from "viem/chains";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

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

function hasEthereumProvider(value: unknown): value is { request: (...args: unknown[]) => Promise<unknown> } {
  return !!value && typeof value === "object" && "request" in value;
}

function getInjectedProvider(): Eip1193Provider | null {
  const maybeProvider = (window as Window & { ethereum?: unknown }).ethereum;
  if (hasEthereumProvider(maybeProvider)) {
    return maybeProvider as Eip1193Provider;
  }
  return null;
}

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
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<string>("Connect wallet to join this market.");

  const marketIsClosed = useMemo(() => Date.now() >= closeTime * 1000, [closeTime]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const optionFromQuery = Number(params.get("option"));
    if (Number.isInteger(optionFromQuery) && options.some((option) => option.index === optionFromQuery)) {
      setSelectedOption(optionFromQuery);
    }
  }, [options]);

  async function connectWallet() {
    if (!hasEthereumProvider((window as unknown as { ethereum?: unknown }).ethereum)) {
      setStatus("No injected wallet found. Open inside a wallet-enabled browser.");
      return;
    }

    const ethereum = getInjectedProvider();
    if (!ethereum) {
      setStatus("No injected wallet found. Open inside a wallet-enabled browser.");
      return;
    }
    const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts[0]) {
      setStatus("Wallet connection failed.");
      return;
    }

    setWalletAddress(accounts[0]);
    setStatus("Wallet connected. Approve and submit your prediction.");
  }

  async function approveAndJoin() {
    if (marketIsClosed) {
      setStatus("Market is closed. New predictions are disabled.");
      return;
    }
    if (!walletAddress) {
      setStatus("Connect wallet first.");
      return;
    }
    const injectedProvider = getInjectedProvider();
    if (!injectedProvider) {
      setStatus("No injected wallet provider found.");
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
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(injectedProvider),
      });

      await walletClient.requestAddresses();

      setStatus(`Submitting ${tokenSymbol} approval...`);
      const approveTxHash = await walletClient.sendTransaction({
        account: walletAddress as `0x${string}`,
        to: tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [contractAddress as `0x${string}`, parsedAmount],
        }),
      });

      setStatus(`Approval sent: ${approveTxHash}. Sending prediction...`);

      const predictionId = makePredictionId(walletAddress, marketId, selectedOption);
      const placeTxHash = await walletClient.sendTransaction({
        account: walletAddress as `0x${string}`,
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
        <button
          type="button"
          onClick={connectWallet}
          className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10"
          disabled={isWorking}
        >
          {walletAddress ? `Connected ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
        </button>
        <button
          type="button"
          onClick={approveAndJoin}
          className="rounded-full bg-fuchsia-400/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-60"
          disabled={isWorking || !walletAddress || marketIsClosed}
        >
          {marketIsClosed ? "Market Closed" : isWorking ? "Submitting..." : `Approve + Join (${tokenSymbol})`}
        </button>
      </div>

      <p className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/80 px-3 py-2 text-xs text-cyan-50/85">{status}</p>
    </section>
  );
}
