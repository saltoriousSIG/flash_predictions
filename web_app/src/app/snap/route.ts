import { TWITCH_CHANNEL } from "../lib/config";
import { getLatestMarketSnapshot } from "../lib/market";

const SNAP_CONTENT_TYPE = "application/vnd.farcaster.snap+json";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type, X-Snap-Payload, X-Farcaster-Signature, Authorization",
};

function getBaseUrl(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function jsonSnap(body: unknown, isPersonalized = false) {
  return Response.json(body, {
    headers: {
      "Content-Type": SNAP_CONTENT_TYPE,
      Vary: "Accept, X-Snap-Payload",
      "Cache-Control": isPersonalized ? "private, no-store" : "public, no-store",
      ...CORS_HEADERS,
    },
  });
}

function fallbackHtml() {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8" /><title>Flash Predictions Snap</title></head><body style="font-family: sans-serif; padding: 24px;"><h1>Flash Predictions Snap</h1><p>Open this URL inside Farcaster to interact with the prediction market.</p><p><a href="/">Go to mini app</a></p></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        Link: `</snap>; rel="alternate"; type="${SNAP_CONTENT_TYPE}"`,
        Vary: "Accept",
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    }
  );
}

function renderNoMarketSnap(baseUrl: string) {
  return {
    version: "2.0",
    theme: { accent: "blue" },
    ui: {
      root: "page",
      elements: {
        page: { type: "stack", props: {}, children: ["title", "body", "open"] },
        title: { type: "text", props: { content: "Flash Predictions", weight: "bold" } },
        body: { type: "text", props: { content: "No live market right now. Open the mini app for updates.", size: "sm" } },
        open: {
          type: "button",
          props: { label: "Open mini app", variant: "primary" },
          on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/?channel=${encodeURIComponent(TWITCH_CHANNEL)}` } } },
        },
      },
    },
  };
}

function getMarketStatus(market: NonNullable<Awaited<ReturnType<typeof getLatestMarketSnapshot>>>) {
  if (market.cancelled) return "Cancelled";
  if (market.resolved) return "Resolved";
  if (market.isClosed || Date.now() >= market.closeTime * 1000) return "Closed";
  return "Open";
}

function renderGetSnap(baseUrl: string, market: NonNullable<Awaited<ReturnType<typeof getLatestMarketSnapshot>>>) {
  const options = market.options.slice(0, 2);
  const first = options[0] ?? { index: 0, label: "Option 1", poolDisplay: "0" };
  const second = options[1] ?? { index: 1, label: "Option 2", poolDisplay: "0" };
  const status = getMarketStatus(market);

  return {
    version: "2.0",
    theme: { accent: "blue" },
    ui: {
      root: "page",
      elements: {
        page: { type: "stack", props: {}, children: ["title", "meta", "pool", "pickOne", "pickTwo", "open", "share"] },
        title: { type: "text", props: { content: market.question, weight: "bold" } },
        meta: { type: "text", props: { content: `Status: ${status} · #${market.marketId}`, size: "sm" } },
        pool: {
          type: "text",
          props: {
            content: `${first.label}: ${first.poolDisplay} ${market.tokenSymbol}  |  ${second.label}: ${second.poolDisplay} ${market.tokenSymbol}`,
            size: "sm",
          },
        },
        pickOne: {
          type: "button",
          props: { label: first.label, variant: "primary" },
          on: { press: { action: "submit", params: { target: `${baseUrl}/snap?action=pick&option=${first.index}` } } },
        },
        pickTwo: {
          type: "button",
          props: { label: second.label },
          on: { press: { action: "submit", params: { target: `${baseUrl}/snap?action=pick&option=${second.index}` } } },
        },
        open: {
          type: "button",
          props: { label: "Open mini app" },
          on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/?marketId=${market.marketId}&channel=${encodeURIComponent(TWITCH_CHANNEL)}` } } },
        },
        share: {
          type: "button",
          props: { label: "Share market" },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: `Live on Flash Predictions: ${market.question}`,
                embeds: [`${baseUrl}/snap`],
              },
            },
          },
        },
      },
    },
  };
}

function renderPostSnap(
  baseUrl: string,
  market: NonNullable<Awaited<ReturnType<typeof getLatestMarketSnapshot>>>,
  selectedOptionIndex: number
) {
  const selected = market.options.find((option) => option.index === selectedOptionIndex);
  const selectedLabel = selected?.label ?? `Option ${selectedOptionIndex}`;
  const status = getMarketStatus(market);

  return {
    version: "2.0",
    theme: { accent: "blue" },
    ui: {
      root: "page",
      elements: {
        page: { type: "stack", props: {}, children: ["title", "body", "status", "open", "again", "share"] },
        title: { type: "text", props: { content: "Vote selected", weight: "bold" } },
        body: { type: "text", props: { content: `You picked: ${selectedLabel}`, size: "sm" } },
        status: { type: "text", props: { content: `Market status: ${status}`, size: "sm" } },
        open: {
          type: "button",
          props: { label: "Open mini app", variant: "primary" },
          on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/?marketId=${market.marketId}&option=${selectedOptionIndex}` } } },
        },
        again: {
          type: "button",
          props: { label: "Back to options" },
          on: { press: { action: "submit", params: { target: `${baseUrl}/snap` } } },
        },
        share: {
          type: "button",
          props: { label: "Share vote" },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: `I picked ${selectedLabel} on Flash Predictions.`,
                embeds: [`${baseUrl}/snap`],
              },
            },
          },
        },
      },
    },
  };
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  const baseUrl = getBaseUrl(request);
  if (!accept.includes(SNAP_CONTENT_TYPE)) {
    return fallbackHtml();
  }
  try {
    const market = await getLatestMarketSnapshot();
    return jsonSnap(market ? renderGetSnap(baseUrl, market) : renderNoMarketSnap(baseUrl));
  } catch {
    return jsonSnap(renderNoMarketSnap(baseUrl));
  }
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const option = url.searchParams.get("option");

  try {
    const market = await getLatestMarketSnapshot();
    if (!market) {
      return jsonSnap(renderNoMarketSnap(baseUrl), true);
    }

    if (action === "pick") {
      const selectedOptionIndex = Number(option);
      if (Number.isInteger(selectedOptionIndex)) {
        return jsonSnap(renderPostSnap(baseUrl, market, selectedOptionIndex), true);
      }
      return jsonSnap(renderGetSnap(baseUrl, market), true);
    }

    return jsonSnap(renderGetSnap(baseUrl, market), true);
  } catch {
    return jsonSnap(renderNoMarketSnap(baseUrl), true);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Max-Age": "86400",
    },
  });
}
