import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", label: "Overview" },
  { to: "/funding", icon: "M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z", label: "Funding" },
  { to: "/heatmap", icon: "M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z", label: "Heatmap" },
  { to: "/screener", icon: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35", label: "Screener" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-card border-r border-border flex flex-col items-center py-4 z-50">
      <NavLink to="/" className="mb-8 text-accent font-bold">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </NavLink>
      <nav className="flex flex-col gap-2">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            title={n.label}
            className={({ isActive }) =>
              `p-3 rounded-lg transition-colors ${
                isActive ? "bg-accent/20 text-accent" : "text-muted hover:text-fg hover:bg-card-hover"
              }`
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.icon} />
            </svg>
          </NavLink>
        ))}
      </nav>
      <a
        href="https://pacifica.fi"
        target="_blank"
        rel="noopener noreferrer"
        title="Pacifica"
        className="mt-auto mb-4 text-muted hover:text-fg transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </aside>
  );
}
