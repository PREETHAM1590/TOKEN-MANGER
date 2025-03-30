"use client"

import { FC, useCallback, useState, useEffect, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletName } from '@solana/wallet-adapter-base'
import { Button } from '@/components/ui/button'
import { isWalletReady } from '@/lib/solana/connection-helper'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

// Icons for wallets
const PhantomIcon = () => (
  <svg width="24" height="24" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="64" fill="#551BF9"/>
    <path d="M110.584 64.9142H99.142C99.142 41.8335 80.284 23.0713 57.1423 23.0713C34.5237 23.0713 16.0095 41.0618 15.4759 63.5166C14.917 87.2057 34.4759 107.071 58.1651 107.071H64.3142C85.1514 107.071 110.584 89.356 110.584 64.9142Z" fill="white"/>
    <path d="M77.8499 64.8975H89.2916C89.2916 75.3539 80.7654 83.8802 70.3089 83.8802C59.8525 83.8802 51.3262 75.3539 51.3262 64.8975C51.3262 54.4411 59.8525 45.9148 70.3089 45.9148V57.3564C66.0318 57.3564 62.7678 60.6204 62.7678 64.8975C62.7678 69.1747 66.0318 72.4386 70.3089 72.4386C74.5861 72.4386 77.8499 69.1747 77.8499 64.8975Z" fill="white"/>
  </svg>
)

const SolflareIcon = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#FC822B"/>
    <path d="M22.7134 8.74661L16.7261 6L10.6 8.39339L12.0456 21.6066L16.6572 26L21.1915 21.2534L22.7134 8.74661Z" fill="white"/>
    <path opacity="0.6" d="M19.4527 13.1489L16.2125 11.8085L12.9035 13.1489L13.617 19.6596L16.1749 21.9574L18.6861 19.4681L19.4527 13.1489Z" fill="#FC822B"/>
  </svg>
)

interface WalletOptionProps {
  name: string
  icon: React.ReactNode
  onClick: () => void
  available: boolean
  loading: boolean
}

const WalletOption: FC<WalletOptionProps> = ({ name, icon, onClick, available, loading }) => {
  return (
    <Button
      onClick={onClick}
      disabled={!available || loading}
      variant={available ? "outline" : "secondary"}
      size="lg"
      className="flex items-center justify-center gap-3 w-full py-6 mb-3 relative overflow-hidden transition-all duration-200 hover:shadow-md"
    >
      <span className="flex items-center justify-center w-8 h-8">
        {icon}
      </span>
      <span className="font-medium text-base">
        {loading ? 'Connecting...' : `Connect ${name}`}
      </span>
      {loading && (
        <Loader2 className="w-4 h-4 animate-spin ml-2 absolute right-4" />
      )}
    </Button>
  )
}

export const QuickConnectWallet: FC = () => {
  const { select, wallet, connect, connected, connecting } = useWallet()
  const [loadingWallet, setLoadingWallet] = useState<string | null>(null)
  const [clientHasLoaded, setClientHasLoaded] = useState(false)
  
  // Mark when client has fully loaded to prevent hydration mismatch
  useEffect(() => {
    setClientHasLoaded(true)
  }, [])
  
  // Fast detection of available wallets using direct window checks for speed
  const availableWallets = useMemo(() => {
    // Always return false during server rendering to match initial client state
    if (typeof window === 'undefined' || !clientHasLoaded) {
      return { phantom: false, solflare: false };
    }
    
    // Direct window checks are faster than function calls
    return {
      phantom: 'phantom' in window && !!(window as any).phantom?.solana?.isPhantom,
      solflare: 'solflare' in window && !!(window as any).solflare?.isSolflare
    };
  }, [clientHasLoaded]);

  // Ultra-fast wallet connection with parallel initialization
  const handleWalletConnect = useCallback(async (walletName: string) => {
    try {
      setLoadingWallet(walletName);
      
      // Show immediate feedback
      const toastId = toast.loading(`Connecting to ${walletName}...`);
      
      // Parallel wallet selection and connection preparation
      let walletSelected = false;
      
      // Select wallet with proper typing
      if (walletName === 'phantom') {
        await select('Phantom' as WalletName);
        walletSelected = true;
      } else if (walletName === 'solflare') {
        await select('Solflare' as WalletName);
        walletSelected = true;
      } else {
        throw new Error('Unsupported wallet');
      }
      
      if (!walletSelected) {
        throw new Error('Wallet not available');
      }
      
      // Super fast connection with short timeout
      const connectPromise = connect();
      
      // Extremely short timeout for perceived responsiveness
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      );
      
      // Race for fastest possible connection
      await Promise.race([connectPromise, timeoutPromise]);
      
      // Dismiss the loading toast on success
      toast.dismiss(toastId);
      
    } catch (error: any) {
      console.error('Quick connect error:', error);
      
      // Specific error messages for better UX
      if (error.message.includes('timeout')) {
        toast.error('Connection taking too long');
      } else if (error.message.includes('rejected')) {
        toast.error('Connection rejected by user');
      } else {
        toast.error('Failed to connect');
      }
    } finally {
      setLoadingWallet(null);
    }
  }, [select, connect]);

  // Don't show if already connected
  if (connected) {
    return null;
  }

  return (
    <div className="flex flex-col w-full max-w-sm mx-auto bg-card border rounded-lg shadow-sm p-6">
      <h3 className="text-xl font-semibold text-center mb-5">Quick Connect</h3>
      
      <WalletOption
        name="Phantom"
        icon={<PhantomIcon />}
        onClick={() => handleWalletConnect('phantom')}
        available={clientHasLoaded && availableWallets.phantom}
        loading={loadingWallet === 'phantom'}
      />
      
      <WalletOption
        name="Solflare"
        icon={<SolflareIcon />}
        onClick={() => handleWalletConnect('solflare')}
        available={clientHasLoaded && availableWallets.solflare}
        loading={loadingWallet === 'solflare'}
      />
      
      {clientHasLoaded && (!availableWallets.phantom && !availableWallets.solflare) && (
        <div className="bg-muted rounded-md p-4 mt-2">
          <p className="text-center text-sm text-muted-foreground">
            No wallets detected. Install Phantom or Solflare for instant connection.
          </p>
        </div>
      )}
    </div>
  );
} 