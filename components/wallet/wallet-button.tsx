"use client"

import { useCallback, useEffect, useState, memo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2, Power } from "lucide-react"
import { isWalletReady } from "@/lib/solana/connection-helper"

// Use type declarations instead of global interface to avoid conflicts
type PhantomWindow = Window & {
  phantom?: {
    solana?: {
      isPhantom?: boolean;
    };
  };
}

type SolflareWindow = Window & {
  solflare?: {
    isSolflare?: boolean;
  };
}

// Optimized wallet button styles - cached for performance
const walletButtonStyles = {
  base: "rounded-full font-medium",
  connected: "bg-primary text-primary-foreground hover:bg-primary/90",
  disconnected: "bg-muted text-muted-foreground hover:bg-muted/90",
}

interface WalletButtonProps {
  className?: string
}

function WalletButton({ className }: WalletButtonProps) {
  // Cached wallet state for faster rendering
  const { wallet, publicKey, connecting, connected, disconnect, connect } = useWallet()
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Cache wallet availability for faster checks
  const [detectedWallet, setDetectedWallet] = useState<string | null>(null)

  // Fast local implementation to detect wallet availability
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true)
      
      // Use non-blocking detection
      setTimeout(() => {
        // Use type assertions to safely check for wallets
        const win = window as PhantomWindow & SolflareWindow
        
        // Detect most common wallets synchronously
        if (win.phantom?.solana?.isPhantom) {
          setDetectedWallet('Phantom')
        } else if (win.solflare?.isSolflare) {
          setDetectedWallet('Solflare')
        }
      }, 0)
    }
  }, [])

  // Ultra-optimized connection handling
  const handleConnection = useCallback(async () => {
    if (connecting) return
    
    if (connected && disconnect) {
      await disconnect()
      return
    }
    
    if (!connected && wallet && connect) {
      try {
        setIsLoading(true)
        await connect()
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
  }, [connecting, connected, disconnect, wallet, connect])

  // Fast placeholder rendering optimized for quick display
  const renderPlaceholder = () => {
    if (!isClient) {
      return (
        <div className={cn(
          "h-10 w-[150px] animate-pulse rounded-full bg-muted", 
          className
        )} />
      )
    }
    
    const walletName = detectedWallet || "Wallet"
    return (
      <Button 
        variant="outline"
        className={cn(
          walletButtonStyles.base,
          walletButtonStyles.disconnected,
          "h-10 px-4",
          className
        )}
        onClick={handleConnection}
        disabled={!wallet}
      >
        Connect {walletName}
      </Button>
    )
  }

  // If not connected, show fast placeholder
  if (!publicKey) {
    return renderPlaceholder()
  }

  // Abbreviated address for faster display
  const abbreviatedAddress = `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`

  return (
    <Button
      className={cn(
        walletButtonStyles.base,
        walletButtonStyles.connected,
        "min-w-[150px] h-10 px-4",
        className
      )}
      onClick={handleConnection}
    >
      {isLoading || connecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Power className="mr-2 h-4 w-4" />
      )}
      {abbreviatedAddress}
    </Button>
  )
}

// Memoize for performance
export default memo(WalletButton) 