import { useRef, useEffect, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { WalletButton } from "./WalletButton";

const NAV = [
  { to: "/", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", label: "Overview" },
  { to: "/funding", icon: "M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z", label: "Funding" },
  { to: "/heatmap", icon: "M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z", label: "Heatmap" },
  { to: "/screener", icon: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35", label: "Screener" },
  { to: "/whales", icon: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7zM12 9v6M9 12h6", label: "Whales" },
  { to: "/orderbook", icon: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18", label: "Orderbook" },
  { to: "/tradeflow", icon: "M22 12h-4l-3 9L9 3l-3 9H2", label: "Trade Flow" },
  { to: "/portfolio", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z", label: "Portfolio" },
  { to: "/ai-insights", icon: "M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z", label: "AI Insights" },
  { to: "/copy-tracker", icon: "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 14l2 2 4-4M15 2H9a1 1 0 00-1 1v1a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z", label: "Copy Tracker" },
  { to: "/liquidations", icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Liquidations" },
  { to: "/correlation", icon: "M18 20V10M12 20V4M6 20v-6", label: "Correlation" },
];

export function Sidebar() {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  /* Slide the accent bar to whichever NavLink is active */
  const updateBar = useCallback(() => {
    if (!navRef.current || !barRef.current) return;
    const active = navRef.current.querySelector<HTMLElement>("[data-active='true']");
    if (active) {
      const navRect = navRef.current.getBoundingClientRect();
      const linkRect = active.getBoundingClientRect();
      barRef.current.style.top = `${linkRect.top - navRect.top + (linkRect.height - 24) / 2}px`;
      barRef.current.style.opacity = "1";
    } else {
      barRef.current.style.opacity = "0";
    }
  }, []);

  useEffect(() => {
    // Small delay so DOM has updated from route change
    const id = requestAnimationFrame(updateBar);
    return () => cancelAnimationFrame(id);
  }, [location.pathname, updateBar]);

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-gradient-to-b from-card to-bg border-r border-border flex flex-col items-center py-4 z-50">
      <NavLink to="/" className="mb-8 press-scale block" title="Pacifica Lens">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6"/>
              <stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="8" stroke="url(#logo-accent)" strokeWidth="2"/>
          <circle cx="16" cy="16" r="3" fill="url(#logo-accent)" opacity="0.9"/>
          <line x1="16" y1="5" x2="16" y2="10" stroke="url(#logo-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
          <line x1="16" y1="22" x2="16" y2="27" stroke="url(#logo-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
          <line x1="5" y1="16" x2="10" y2="16" stroke="url(#logo-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
          <line x1="22" y1="16" x2="27" y2="16" stroke="url(#logo-accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
        </svg>
      </NavLink>
      <nav ref={navRef} className="relative flex flex-col gap-1.5">
        {/* Sliding active indicator */}
        <div ref={barRef} className="nav-active-bar" style={{ opacity: 0 }} />

        {NAV.map((n, idx) => (
          <div key={n.to}>
            {idx === 4 && <div className="w-8 divider-gradient my-2" />}
            <NavLink
              to={n.to}
              end={n.to === "/"}
              title={n.label}
              className={({ isActive }) =>
                `nav-link relative p-3 rounded-lg block ${
                  isActive
                    ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]"
                    : "text-muted hover:text-fg hover:bg-card-hover"
                }`
              }
            >
              {({ isActive }) => (
                <svg
                  data-active={isActive}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-150 ease-out ${isActive ? "scale-110" : ""}`}
                >
                  <path d={n.icon} />
                </svg>
              )}
            </NavLink>
          </div>
        ))}
      </nav>
      <div className="mt-auto mb-3">
        <WalletButton />
      </div>
      <a
        href="https://pacifica.fi"
        target="_blank"
        rel="noopener noreferrer"
        title="Pacifica"
        className="mb-4 text-muted hover:text-fg nav-link p-2 rounded-lg"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </aside>
  );
}
