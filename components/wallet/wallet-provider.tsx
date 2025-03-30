"use client"

import { type FC, type ReactNode, useMemo, useState, useCallback, useEffect, memo } from "react"
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react"
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter, 
} from "@solana/wallet-adapter-wallets"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { Commitment } from "@solana/web3.js"
import { toast } from "react-hot-toast"

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css"

// Import local storage adapter for persistence
import { useLocalStorage } from "@/lib/hooks/useLocalStorage"
import { getCachedConnection, initConnectionPool, isWalletReady } from "@/lib/solana/connection-helper"

// Initialize connection pool as early as possible
if (typeof window !== 'undefined') {
  initConnectionPool("https://api.devnet.solana.com");
}

interface WalletContextProviderProps {
  children: ReactNode
}

// Component to track wallet connection state - memoized for performance
const WalletConnectionTracker: FC = memo(() => {
  const { wallet, connected } = useWallet();
  const [, setLastWallet] = useLocalStorage<string | null>("lastConnectedWallet", null);
  
  // Only track when the wallet is connected
  useEffect(() => {
    if (connected && wallet?.adapter?.name) {
      // Store the connected wallet name
      setLastWallet(wallet.adapter.name);
    }
  }, [connected, wallet, setLastWallet]);
  
  return null;
});
WalletConnectionTracker.displayName = 'WalletConnectionTracker';

const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // Use the direct RPC endpoint for fastest performance
  const endpoint = "https://api.devnet.solana.com";
  
  // Only track essential state for faster UI
  const [clientLoaded, setClientLoaded] = useState(false);
  
  // State to track connection persistence
  const [autoConnectEnabled] = useLocalStorage<boolean>("walletAutoConnect", true);
  
  // Track last connected wallet for better persistence
  const [lastWallet] = useLocalStorage<string | null>("lastConnectedWallet", null);

  // Ultra-optimized config
  const connectionConfig = {
    commitment: 'processed' as Commitment,
    confirmTransactionInitialTimeout: 15000, // Reduced to 15 seconds for faster feedback
    disableRetryOnRateLimit: true,
    skipPreflight: true, // Skip preflight for faster transactions
  };

  // Set client loaded to avoid hydration issues - do this only once
  useEffect(() => {
    setClientLoaded(true);
  }, []);

  // Ultra-fast wallet adapters with immediate availability detection
  const wallets = useMemo(() => {
    // Don't load on server to prevent hydration issues
    if (typeof window === 'undefined' || !clientLoaded) {
      return [];
    }
    
    // Since Next.js 15.1.0 registers Phantom as a Standard Wallet,
    // we should avoid creating another adapter for it which causes conflicts
    const detectWallets = () => {
      // Only add adapters for wallets that are not registered as standard wallets
      const availableWallets = [];
      
      // Add Solflare adapter (not registered as standard yet)
      const windowWithSolflare = window as Window & { 
        solflare?: { isSolflare?: boolean } 
      };
      if (windowWithSolflare.solflare?.isSolflare) {
        availableWallets.push(new SolflareWalletAdapter());
      }
      
      // Return available non-standard wallets
      return availableWallets;
    };
    
    // Initial detection
    return detectWallets();
  }, [clientLoaded]);

  // Enhanced error handler with more detail
  const onError = useCallback((error: Error) => {
    const msg = error.message || '';
    console.error('Wallet error:', error);
    
    if (error.name === 'WalletNotSelectedError') {
      // Don't show toast for wallet selection errors - these are handled internally
      return;
    } else if (msg.includes('User rejected')) {
      toast.error('Connection rejected');
    } else if (msg.includes('timeout')) {
      toast.error('Connection timeout');
    } else {
      toast.error(`Connection error: ${error.name || 'Unknown'}`);
    }
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={clientLoaded && autoConnectEnabled}
        onError={onError}
        localStorageKey="walletAdapter"
      >
        <WalletConnectionTracker />
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default memo(WalletContextProvider);


