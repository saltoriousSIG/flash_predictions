import { STREAM_EMBED_URL } from "../lib/config";
import { getLatestMarketSnapshot } from "../lib/market";

const SNAP_CONTENT_TYPE = "application/vnd.farcaster.snap+json";

function jsonSnap(body: unknown, isPersonalized = false) {
  return Response.json(body, {
    headers: {
      "Content-Type": SNAP_CONTENT_TYPE,
      Vary: "Accept, X-Snap-Payload",
      "Cache-Control": isPersonalized ? "private, max-age=30" : "public, max-age=30",
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
      },
    }
  );
}

function resolveBaseUrl(request: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function renderNoMarketSnap(baseUrl: string) {
  return {
    version: "2.0",
    theme: { accent: "orange" },
    ui: {
      root: "page",
      elements: {
        page: { type: "stack", props: {}, children: ["title", "body", "cta"] },
        title: { type: "text", props: { content: "No live market yet", weight: "bold" } },
        body: { type: "text", props: { content: "Create a market onchain first, then reload this snap.", size: "sm" } },
        cta: {
          type: "button",
          props: { label: "Open mini app", variant: "primary" },
          on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/` } } },
        },
      },
    },
  };
}

function renderMarketSnap(baseUrl: string, optionIndex?: number) {
  return async () => {
    const market = await getLatestMarketSnapshot();
    if (!market) return renderNoMarketSnap(baseUrl);

    const status = market.cancelled ? "Cancelled" : market.resolved ? "Resolved" : market.isClosed || Date.now() >= market.closeTime * 1000 ? "Closed" : "Open";
    const openMiniAppTarget = optionIndex === undefined ? `${baseUrl}/` : `${baseUrl}/?option=${optionIndex}&marketId=${market.marketId}`;

    if (optionIndex !== undefined && market.options[optionIndex]) {
      return {
        version: "2.0",
        theme: { accent: "orange" },
        ui: {
          root: "page",
          elements: {
            page: { type: "stack", props: {}, children: ["title", "choice", "status", "pool", "open", "share"] },
            title: { type: "text", props: { content: market.question, weight: "bold" } },
            choice: { type: "text", props: { content: `You picked: ${market.options[optionIndex].label}` } },
            status: { type: "text", props: { content: `Status: ${status}`, size: "sm" } },
            pool: { type: "text", props: { content: `Pool: ${market.totalPoolDisplay} ${market.tokenSymbol}`, size: "sm" } },
            open: {
              type: "button",
              props: { label: "Open mini app", variant: "primary" },
              on: { press: { action: "open_mini_app", params: { target: openMiniAppTarget } } },
            },
            share: {
              type: "button",
              props: { label: "Share market", icon: "share" },
              on: {
                press: {
                  action: "compose_cast",
                  params: { text: `I'm following this challenge: ${market.question}`, embeds: [`${baseUrl}/snap`] },
                },
              },
            },
          },
        },
      };
    }

    const optionButtons = market.options.slice(0, 4).map((option) => ({
      id: `option-${option.index}`,
      label: option.label.slice(0, 30),
      target: `${baseUrl}/snap?action=pick&option=${option.index}`,
    }));

    const children = ["title", "meta", "status", "pool", ...optionButtons.map((button) => button.id), "watch"];
    const elements: Record<string, unknown> = {
      page: { type: "stack", props: {}, children },
      title: { type: "text", props: { content: market.question, weight: "bold" } },
      meta: { type: "text", props: { content: `Market #${market.marketId} • closes ${new Date(market.closeTime * 1000).toLocaleTimeString()}`, size: "sm" } },
      status: { type: "text", props: { content: `Status: ${status}`, size: "sm" } },
      pool: { type: "text", props: { content: `Pool: ${market.totalPoolDisplay} ${market.tokenSymbol}`, size: "sm" } },
      watch: {
        type: "button",
        props: { label: "Watch stream", icon: "play" },
        on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/?stream=${encodeURIComponent(STREAM_EMBED_URL)}` } } },
      },
    };

    for (const button of optionButtons) {
      elements[button.id] = {
        type: "button",
        props: { label: button.label, variant: "secondary" },
        on: { press: { action: "submit", params: { target: button.target } } },
      };
    }

    return {
      version: "2.0",
      theme: { accent: "orange" },
      ui: {
        root: "page",
        elements,
      },
    };
  };
}

async function snapResponse(request: Request) {
  const baseUrl = resolveBaseUrl(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const option = url.searchParams.get("option");
  const optionIndex = option === null ? undefined : Number(option);

  if (action === "pick" && Number.isInteger(optionIndex)) {
    const payload = await renderMarketSnap(baseUrl, optionIndex)();
    return jsonSnap(payload, true);
  }

  const payload = await renderMarketSnap(baseUrl)();
  return jsonSnap(payload);
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  if (accept.includes(SNAP_CONTENT_TYPE)) {
    return snapResponse(request);
  }
  return fallbackHtml();
}

export async function POST(request: Request) {
  return snapResponse(request);
}
