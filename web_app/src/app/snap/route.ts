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

function snapPayload(baseUrl: string) {
  return {
    version: "2.0",
    theme: { accent: "blue" },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack",
          props: {},
          children: ["title", "body", "open"],
        },
        title: {
          type: "text",
          props: { content: "Flash Predictions", weight: "bold" },
        },
        body: {
          type: "text",
          props: { content: "Open the mini app to place your prediction.", size: "sm" },
        },
        open: {
          type: "button",
          props: { label: "Open mini app", variant: "primary" },
          on: {
            press: {
              action: "open_mini_app",
              params: { target: `${baseUrl}/` },
            },
          },
        },
      },
    },
  };
}

function fallbackHtml(baseUrl: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8" /><title>Flash Predictions Snap</title></head><body style="font-family: sans-serif; padding: 24px;"><h1>Flash Predictions Snap</h1><p>Open inside Farcaster to render the snap.</p><p><a href="${baseUrl}/">Go to mini app</a></p></body></html>`,
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

function snapJson(baseUrl: string) {
  return Response.json(snapPayload(baseUrl), {
    headers: {
      "Content-Type": SNAP_CONTENT_TYPE,
      Vary: "Accept",
      "Cache-Control": "public, max-age=30",
      ...CORS_HEADERS,
    },
  });
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") || "";
  const baseUrl = getBaseUrl(request);
  if (accept.includes(SNAP_CONTENT_TYPE)) {
    return snapJson(baseUrl);
  }
  return fallbackHtml(baseUrl);
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl(request);
  return snapJson(baseUrl);
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
