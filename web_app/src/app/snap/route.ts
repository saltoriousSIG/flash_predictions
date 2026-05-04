import { STREAM_EMBED_URL } from "../lib/config";

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
      "Cache-Control": isPersonalized ? "private, max-age=30" : "public, max-age=30",
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
        ...CORS_HEADERS,
      },
    }
  );
}

function renderGetSnap(baseUrl: string) {
  return {
    version: "2.0",
    theme: { accent: "blue" },
    ui: {
      root: "page",
      elements: {
        page: { type: "stack", props: {}, children: ["title", "body", "pickYes", "pickNo", "open"] },
        title: { type: "text", props: { content: "Flash Predictions", weight: "bold" } },
        body: { type: "text", props: { content: "Will FattyButHappy complete the food challenge?", size: "sm" } },
        pickYes: {
          type: "button",
          props: { label: "Yes", variant: "primary" },
          on: { press: { action: "submit", params: { target: `${baseUrl}/snap?action=pick&option=yes` } } },
        },
        pickNo: {
          type: "button",
          props: { label: "No" },
          on: { press: { action: "submit", params: { target: `${baseUrl}/snap?action=pick&option=no` } } },
        },
        open: {
          type: "button",
          props: { label: "Open mini app" },
          on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/?stream=${encodeURIComponent(STREAM_EMBED_URL)}` } } },
        },
      },
    },
  };
}

function renderPostSnap(baseUrl: string, option: string | null) {
  const isYes = option === "yes";
  const label = isYes ? "Yes" : "No";

  return {
    version: "2.0",
    theme: { accent: "blue" },
    ui: {
      root: "page",
      elements: {
        page: { type: "stack", props: {}, children: ["title", "body", "open", "share"] },
        title: { type: "text", props: { content: "Vote recorded", weight: "bold" } },
        body: { type: "text", props: { content: `You picked: ${label}`, size: "sm" } },
        open: {
          type: "button",
          props: { label: "Open mini app", variant: "primary" },
          on: { press: { action: "open_mini_app", params: { target: `${baseUrl}/?option=${isYes ? 0 : 1}` } } },
        },
        share: {
          type: "button",
          props: { label: "Share" },
          on: {
            press: {
              action: "compose_cast",
              params: {
                text: `I voted ${label} on Flash Predictions.`,
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
  return jsonSnap(renderGetSnap(baseUrl));
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const option = url.searchParams.get("option");

  if (action === "pick") {
    return jsonSnap(renderPostSnap(baseUrl, option), true);
  }

  return jsonSnap(renderGetSnap(baseUrl));
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
