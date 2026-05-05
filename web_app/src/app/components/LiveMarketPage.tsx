"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CONTRACT_ADDRESS, TWITCH_CHANNEL } from "../lib/config";
import { JoinMarketCard } from "./JoinMarketCard";
import { UserNavbar } from "./UserNavbar";
import { TwitchStreamEmbed } from "./TwitchStreamEmbed";
import type { MarketSnapshot } from "../lib/market";

async function fetchLatestMarketSnapshot(): Promise<MarketSnapshot> {
  const response = await fetch("/api/market/latest", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch market snapshot: ${response.status}`);
  }
  return response.json();
}

function formatUnixTimestamp(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function marketStatus({
  resolved,
  cancelled,
  isClosed,
  closeTime,
}: {
  resolved: boolean;
  cancelled: boolean;
  isClosed: boolean;
  closeTime: number;
}) {
  if (cancelled) return "Cancelled";
  if (resolved) return "Resolved";
  if (isClosed || Date.now() >= closeTime * 1000) return "Closed";
  return "Open";
}

export function LiveMarketPage({ initialMarket }: { initialMarket: MarketSnapshot }) {
  const parentDomains = (() => {
    const set = new Set<string>();
    const envUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    if (typeof window !== "undefined") {
      set.add(window.location.hostname);
    }

    if (envUrl) {
      try {
        set.add(new URL(envUrl).hostname);
      } catch {
        // ignore invalid NEXT_PUBLIC_APP_URL
      }
    }

    set.add("flash-predictions-web-app.vercel.app");
    set.add("farcaster.xyz");

    return Array.from(set).filter(Boolean);
  })();

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
                {market ? market.question : "No Live Market Yet"}
              </h1>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-3xl border border-cyan-300/30 bg-slate-950/70 shadow-[0_0_0_1px_rgba(0,255,220,0.12),0_25px_55px_-36px_rgba(56,189,248,0.65)]">
            <div className="border-b border-cyan-300/25 px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="text-lg font-semibold text-cyan-100">Live Stream</h2>
            </div>
            <TwitchStreamEmbed channel={TWITCH_CHANNEL} parentDomains={parentDomains} />
          </div>

          <div className="rounded-3xl border border-fuchsia-300/30 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(217,70,239,0.12),0_25px_55px_-36px_rgba(232,121,249,0.65)] sm:p-5">
            <h2 className="text-lg font-semibold text-fuchsia-100">Market Status</h2>
            {!market ? (
              <div className="mt-4 space-y-3 text-sm text-cyan-50/80">
                <p>No market found yet. Create one onchain first.</p>
                <p className="break-all rounded-xl bg-slate-900/80 p-3 font-mono text-[11px] text-cyan-100">Contract: {CONTRACT_ADDRESS}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-cyan-50/80">
                <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-slate-900/75 px-3 py-2">
                  <span>Status</span>
                  <span className="font-semibold text-cyan-200">{marketStatus(market)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-slate-900/75 px-3 py-2">
                  <span>Total Pool</span>
                  <span className="font-semibold text-cyan-200">{market.totalPoolDisplay} {market.tokenSymbol}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-slate-900/75 px-3 py-2">
                  <span>Close Time</span>
                  <span className="font-semibold text-cyan-200">{formatUnixTimestamp(market.closeTime)}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {market && (
          <JoinMarketCard
            marketId={market.marketId}
            options={market.options}
            tokenAddress={market.tokenAddress}
            tokenSymbol={market.tokenSymbol}
            tokenDecimals={market.tokenDecimals}
            contractAddress={CONTRACT_ADDRESS}
            closeTime={market.closeTime}
          />
        )}

        <div className="flex justify-end">
          <Link
            href="/claim"
            className="rounded-full border border-fuchsia-300/50 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-300/15"
          >
            Go to Claim Center
          </Link>
        </div>
      </main>
    </div>
  );
}
