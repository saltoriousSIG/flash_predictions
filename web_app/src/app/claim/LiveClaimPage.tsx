"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CONTRACT_ADDRESS } from "../lib/config";
import { UserNavbar } from "../components/UserNavbar";
import { ClaimMarketCard } from "./ClaimMarketCard";
import type { MarketSnapshot } from "../lib/market";

async function fetchLatestMarketSnapshot(): Promise<MarketSnapshot> {
  const response = await fetch("/api/market/latest", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch market snapshot: ${response.status}`);
  }
  return response.json();
}

export function LiveClaimPage({ initialMarket }: { initialMarket: MarketSnapshot }) {
  const { data: market } = useQuery({
    queryKey: ["latest-market"],
    queryFn: fetchLatestMarketSnapshot,
    initialData: initialMarket,
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 3000,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_15%_20%,_rgba(0,255,220,0.18)_0%,_transparent_28%),radial-gradient(circle_at_85%_5%,_rgba(255,64,129,0.2)_0%,_transparent_36%),linear-gradient(165deg,_#05060e_0%,_#090b16_48%,_#0a1522_100%)] text-cyan-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <section className="rounded-2xl border border-cyan-300/30 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(0,255,220,0.12),0_22px_55px_-36px_rgba(0,255,220,0.8)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4">
            <UserNavbar />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Claim Winnings
              </h1>
              {market && <p className="mt-1 text-sm text-cyan-100/90">Market: {market.question}</p>}
            </div>
            <div>
              <Link
                href="/"
                className="inline-flex rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10"
              >
                Back to Market
              </Link>
            </div>
          </div>
        </section>

        {!market ? (
          <section className="rounded-3xl border border-fuchsia-300/30 bg-slate-950/70 p-5 shadow-[0_0_0_1px_rgba(217,70,239,0.12),0_25px_55px_-36px_rgba(232,121,249,0.65)]">
            <p className="text-sm text-cyan-100/85">No market found yet. Create one onchain first.</p>
            <p className="mt-3 break-all rounded-xl bg-slate-900/80 p-3 font-mono text-[11px] text-cyan-100">Contract: {CONTRACT_ADDRESS}</p>
          </section>
        ) : (
          <ClaimMarketCard
            marketId={market.marketId}
            options={market.options}
            tokenAddress={market.tokenAddress}
            tokenSymbol={market.tokenSymbol}
            tokenDecimals={market.tokenDecimals}
            contractAddress={CONTRACT_ADDRESS}
            totalPoolRaw={market.totalPoolRaw}
            resolved={market.resolved}
            cancelled={market.cancelled}
            winningOptionIndex={market.winningOptionIndex}
            creator={market.creator}
            creatorFeeBps={market.creatorFeeBps}
            platformFeeBps={market.platformFeeBps}
          />
        )}
      </main>
    </div>
  );
}
