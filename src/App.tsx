import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
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
import Liquidations from "@/pages/Liquidations";
import Correlation from "@/pages/Correlation";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <div className="ambient-bg"><div className="ambient-blob-3" /></div>
      <Sidebar />
      <TopBar />
      <main className="ml-16 pt-14 min-h-screen overflow-auto scroll-fade relative z-10 flex flex-col">
        <div className="px-6 py-5 flex-1">
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
            <Route path="/liquidations" element={<Liquidations />} />
            <Route path="/correlation" element={<Correlation />} />
          </Routes>
        </div>
        <footer className="ml-0 px-6 pb-4 pt-2">
          <div className="page-footer">
            <span>
              Powered by{" "}
              <span className="text-accent font-medium">Pacifica API</span>
              {" "}&middot; Real-time data &middot; 63+ markets
            </span>
            <span className="font-mono">
              Built for Pacifica Hackathon 2026
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}
