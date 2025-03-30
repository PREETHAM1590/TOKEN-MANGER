"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Types for window wallet detection
type PhantomWindow = Window & {
  phantom?: {
    solana?: {
      isPhantom?: boolean
    }
  }
}

type SolflareWindow = Window & {
  solflare?: {
    isSolflare?: boolean
  }
}

type BraveWindow = Window & {
  solana?: {
    isBraveWallet?: boolean
  }
}

type BackpackWindow = Window & {
  backpack?: {
    isBackpack?: boolean
  }
}

export default function WalletConnect() {
  const { select, connect, connecting, connected, wallet, publicKey } = useWallet()
  const [detectedWallets, setDetectedWallets] = useState<string[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Detect available wallets
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    setIsClient(true)
    
    const win = window as PhantomWindow & SolflareWindow & BraveWindow & BackpackWindow
    const detected: string[] = []
    
    // Detect Phantom
    if (win.phantom?.solana?.isPhantom) {
      detected.push("Phantom")
    }
    
    // Detect Solflare
    if (win.solflare?.isSolflare) {
      detected.push("Solflare")
    }
    
    // Detect Brave Wallet
    if (win.solana?.isBraveWallet) {
      detected.push("Brave")
    }
    
    // Detect Backpack
    if (win.backpack?.isBackpack) {
      detected.push("Backpack")
    }
    
    setDetectedWallets(detected)
  }, [])

  // Handle wallet connection
  const handleConnect = async (walletName: string) => {
    try {
      setError(null)
      setSelectedWallet(walletName)
      
      // Find and select the wallet adapter
      if (select) {
        select(walletName)
      }
      
      // Wait a moment for wallet selection to take effect
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Connect to the wallet
      if (connect) {
        await connect()
      }
    } catch (err) {
      console.error('Wallet connection error:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      setSelectedWallet(null)
    }
  }

  return (
    <Card className="max-w-md mx-auto border shadow-sm">
      <CardHeader className="text-center pb-4">
        <div className="bg-primary/10 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4">
          <WalletIcon className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-semibold">Connect Your Wallet</CardTitle>
        <CardDescription className="text-muted-foreground">
          Connect your Solana wallet to create, mint, and manage tokens on the Solana blockchain.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!isClient ? (
          <div className="py-4 text-center text-muted-foreground">
            Checking for wallets...
          </div>
        ) : detectedWallets.length === 0 ? (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertDescription>
                No Solana wallets detected in your browser. Please install a wallet like Phantom or Solflare.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col space-y-2">
              <a 
                href="https://phantom.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Install Phantom Wallet
              </a>
              <a 
                href="https://solflare.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Install Solflare Wallet
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-center mb-2">
              {detectedWallets.length} wallet{detectedWallets.length !== 1 ? 's' : ''} detected
            </p>
            
            <div className="flex flex-col space-y-2">
              {detectedWallets.map((walletName) => (
                <Button
                  key={walletName}
                  variant="outline"
                  className={`w-full justify-start ${selectedWallet === walletName ? 'border-primary' : ''}`}
                  onClick={() => handleConnect(walletName)}
                  disabled={connecting || connected}
                >
                  <div className="flex items-center">
                    <img 
                      src={`/wallets/${walletName.toLowerCase()}.svg`} 
                      alt={walletName}
                      className="h-5 w-5 mr-2"
                      onError={(e) => {
                        e.currentTarget.src = "/wallets/default-wallet.svg";
                      }}
                    />
                    Connect {walletName}
                  </div>
                </Button>
              ))}
            </div>
            
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!error && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                By connecting, you agree to the terms of use and privacy policy.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

