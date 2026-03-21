import { usePrivy } from "@privy-io/react-auth";

export function WalletButton() {
  const { login, authenticated } = usePrivy();

  if (authenticated) return null;

  return (
    <button
      onClick={() => login()}
      title="Connect Wallet"
      className="p-2.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 press-scale"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 010-4h14v4" />
        <path d="M3 5v14a2 2 0 002 2h16v-5" />
        <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    </button>
  );
}

export function WalletStatus() {
  const { login, logout, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;

  if (!authenticated || !address) {
    return (
      <button
        onClick={() => login()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm hover:bg-accent/20 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12V7H5a2 2 0 010-4h14v4" />
          <path d="M3 5v14a2 2 0 002 2h16v-5" />
          <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30">
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
      <span className="text-sm font-mono text-accent" title={address}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <button
        onClick={() => void logout()}
        title="Disconnect"
        className="text-xs text-muted hover:text-down transition-colors ml-1"
      >
        x
      </button>
    </div>
  );
}
