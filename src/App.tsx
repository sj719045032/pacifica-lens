import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import Overview from "@/pages/Overview";
import Funding from "@/pages/Funding";
import Heatmap from "@/pages/Heatmap";
import Screener from "@/pages/Screener";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-16 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/funding" element={<Funding />} />
          <Route path="/heatmap" element={<Heatmap />} />
          <Route path="/screener" element={<Screener />} />
        </Routes>
      </main>
    </div>
  );
}
