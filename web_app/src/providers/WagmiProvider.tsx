"use client";

import { type ReactNode } from "react";
import { WagmiProvider as WagmiLib, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

const config = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  },
  connectors: [farcasterMiniApp()],
});

export function WagmiProvider({ children }: { children: ReactNode }) {
  return <WagmiLib config={config}>{children}</WagmiLib>;
}
