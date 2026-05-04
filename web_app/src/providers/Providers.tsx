"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "./QueryProvider";
import { WagmiProvider } from "./WagmiProvider";
import { FrameSDKProvider } from "./FrameSDKProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider>
      <QueryProvider>
        <FrameSDKProvider>{children}</FrameSDKProvider>
      </QueryProvider>
    </WagmiProvider>
  );
}
