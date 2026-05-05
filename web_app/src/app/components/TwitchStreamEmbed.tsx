"use client";

import { useMemo } from "react";

type TwitchStreamEmbedProps = {
  channel: string;
  parentDomain: string;
};

export function TwitchStreamEmbed({ channel, parentDomain }: TwitchStreamEmbedProps) {
  const twitchEmbedUrl = useMemo(() => {
    const params = new URLSearchParams({
      channel,
      parent: parentDomain,
      autoplay: "true",
      muted: "true",
    });
    return `https://player.twitch.tv/?${params.toString()}`;
  }, [channel, parentDomain]);

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
