import { getLatestMarketSnapshot } from "../lib/market";
import { LiveClaimPage } from "./LiveClaimPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClaimPage() {
  const market = await getLatestMarketSnapshot();
  return <LiveClaimPage initialMarket={market} />;
}
