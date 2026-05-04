"use client";

import { useFrameSDK } from "../../providers/FrameSDKProvider";

export function FrameIdentityPanel() {
  const {
    isLoaded,
    fUser,
    address,
    isConnected,
  } = useFrameSDK();

  return (
    <section className="rounded-3xl border border-cyan-300/30 bg-slate-950/70 p-4 shadow-[0_0_0_1px_rgba(0,255,220,0.12),0_25px_55px_-36px_rgba(56,189,248,0.65)] sm:p-5">
      <h2 className="text-lg font-semibold text-cyan-100">Farcaster Wallet & Identity</h2>
      <div className="mt-3 space-y-2 text-sm text-cyan-50/85">
        <p>
          SDK Loaded: <span className="font-semibold text-cyan-200">{isLoaded ? "Yes" : "No"}</span>
        </p>
        <p>
          Connected: <span className="font-semibold text-cyan-200">{isConnected ? "Yes" : "No"}</span>
        </p>
        <p>
          SDK User: <span className="font-semibold text-cyan-200">{fUser ? "Available" : "Unavailable"}</span>
        </p>
        <p>
          FID: <span className="font-semibold text-cyan-200">{fUser?.fid ?? "Unavailable"}</span>
        </p>
        <p className="break-all">
          Address: <span className="font-mono text-xs text-cyan-200">{address ?? "Unavailable"}</span>
        </p>
      </div>

      <p className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/80 px-3 py-2 text-xs text-cyan-50/85">
        Session auth is disabled for now. Identity is sourced from Farcaster SDK context + miniapp wallet connector.
      </p>
    </section>
  );
}
