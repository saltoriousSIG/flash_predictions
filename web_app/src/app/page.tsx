import { getLatestMarketSnapshot } from "./lib/market";
import { LiveMarketPage } from "./components/LiveMarketPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const market = await getLatestMarketSnapshot();
  return <LiveMarketPage initialMarket={market} />;
}
