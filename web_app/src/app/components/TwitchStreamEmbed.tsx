"use client";

import { useMemo } from "react";

type TwitchStreamEmbedProps = {
  channel: string;
  parentDomains: string[];
};

export function TwitchStreamEmbed({ channel, parentDomains }: TwitchStreamEmbedProps) {
  const twitchEmbedUrl = useMemo(() => {
    const params = new URLSearchParams({ channel, autoplay: "true", muted: "true" });
    for (const parentDomain of parentDomains) {
      params.append("parent", parentDomain);
    }
    return `https://player.twitch.tv/?${params.toString()}`;
  }, [channel, parentDomains]);

  return (
    <div className="aspect-[4/3] bg-stone-900 sm:aspect-video">
      <iframe
        src={twitchEmbedUrl}
        title={`${channel} Twitch livestream`}
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}
