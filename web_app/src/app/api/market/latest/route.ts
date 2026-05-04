import { getLatestMarketSnapshot } from "../../../lib/market";

export async function GET() {
  try {
    const market = await getLatestMarketSnapshot();
    return Response.json(market, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return Response.json({ error: message }, { status: 500 });
  }
}
