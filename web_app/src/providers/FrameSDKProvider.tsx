"use client";

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import sdk from "@farcaster/miniapp-sdk";
import type { MiniAppSDK } from "@farcaster/miniapp-sdk/dist/types";
import { useAccount, useConnect } from "wagmi";

interface FrameContextValue {
  isLoaded: boolean;
  context: Awaited<MiniAppSDK["context"]> | null;
  fUser: Awaited<MiniAppSDK["context"]>["user"] | null;
  address: string | undefined;
  isConnected: boolean;
}

const FrameSDKContext = createContext<FrameContextValue>({
  isLoaded: false,
  context: null,
  fUser: null,
  address: undefined,
  isConnected: false,
});

export function FrameSDKProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isLoaded, setIsLoaded] = useState(false);
  const [context, setContext] = useState<FrameContextValue["context"]>(null);
  const [fUser, setFUser] = useState<FrameContextValue["fUser"]>(null);

  const { isConnected, address } = useAccount();
  const { connectAsync, connectors } = useConnect();

  const connectRef = useRef({ connectAsync, connectors });
  connectRef.current = { connectAsync, connectors };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const ctx = await sdk.context;
        if (cancelled) return;

        if (!ctx?.user?.fid) {
          setIsLoaded(true);
          return;
        }

        setContext(ctx);
        setFUser({ ...ctx.user });
        setIsLoaded(true);

        await sdk.actions.ready();

        const { connectAsync: ca, connectors: conns } = connectRef.current;
        if (conns.length > 0) {
          try {
            await ca({ connector: conns[0] });
          } catch {
            // ignore connector errors, user can retry manually
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to load Farcaster miniapp context:", message);
        if (pathname !== "/") {
          // leave route intact; app can still run in browser fallback
        }
        setIsLoaded(true);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <FrameSDKContext.Provider
      value={{
        isLoaded,
        context,
        fUser,
        address,
        isConnected: !!isConnected,
      }}
    >
      {children}
    </FrameSDKContext.Provider>
  );
}

export function useFrameSDK() {
  return useContext(FrameSDKContext);
}
