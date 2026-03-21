import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import Overview from "@/pages/Overview";
import Funding from "@/pages/Funding";
import Heatmap from "@/pages/Heatmap";
import Screener from "@/pages/Screener";
import Whales from "@/pages/Whales";
import Orderbook from "@/pages/Orderbook";
import TradeFlow from "@/pages/TradeFlow";
import Portfolio from "@/pages/Portfolio";
import AiInsights from "@/pages/AiInsights";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <TopBar />
      <main className="flex-1 ml-16 pt-14 overflow-auto scroll-fade">
        <div className="px-6 py-5">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/funding" element={<Funding />} />
          <Route path="/heatmap" element={<Heatmap />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/whales" element={<Whales />} />
          <Route path="/orderbook" element={<Orderbook />} />
          <Route path="/tradeflow" element={<TradeFlow />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/ai-insights" element={<AiInsights />} />
        </Routes>
        </div>
      </main>
    </div>
  );
}
