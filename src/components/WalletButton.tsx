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
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-accent/10 border border-accent/25 text-accent text-sm font-medium hover:bg-accent/20 hover:border-accent/40 press-scale transition-all duration-200"
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
    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-up/8 border border-up/20">
      <span className="w-2 h-2 rounded-full bg-up animate-pulse" />
      <span className="text-sm font-mono text-fg" title={address}>
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <button
        onClick={() => void logout()}
        title="Disconnect"
        className="text-muted hover:text-down transition-colors ml-0.5 p-0.5 rounded hover:bg-down/10"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  );
}
