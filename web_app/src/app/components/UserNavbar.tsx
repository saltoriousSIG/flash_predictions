"use client";

import { useFrameSDK } from "../../providers/FrameSDKProvider";

function initialsFromName(name?: string | null) {
  if (!name) return "FC";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserNavbar() {
  const { fUser, isLoaded } = useFrameSDK();
  const username = fUser?.username || fUser?.displayName || "Farcaster User";
  const avatar = fUser?.pfpUrl;

  return (
    <header className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Fatty But Happy</p>
      <div className="flex items-center gap-2">
        {!isLoaded ? (
          <span className="text-xs text-cyan-200/80">Loading…</span>
        ) : (
          <span className="text-xs font-medium text-cyan-100">@{username}</span>
        )}
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={`${username} avatar`}
            className="h-8 w-8 rounded-full border border-cyan-300/40 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/15 text-[11px] font-semibold text-cyan-100">
            {initialsFromName(username)}
          </span>
        )}
      </div>
    </header>
  );
}
