"use client"

import { useEffect, useState, useCallback, memo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useLocalStorage } from "@/lib/hooks/useLocalStorage"
import { Button } from "@/components/ui/button"
import { isWalletReady } from "@/lib/solana/connection-helper"
import { Loader2 } from "lucide-react"

interface QuickConnectWalletProps {
  onConnectStart?: () => void
  onConnectSuccess?: () => void
  onConnectError?: (error: Error) => void
}

// We'll use a different approach to avoid declaration conflicts
type PhantomWindow = Window & {
  phantom?: {
    solana?: {
      isPhantom?: boolean
      connect?: () => Promise<any>
    }
  }
}

type SolflareWindow = Window & {
  solflare?: {
    isSolflare?: boolean
  }
}

// Fast loading component for wallet detection
function QuickConnectWallet({ 
  onConnectStart, 
  onConnectSuccess, 
  onConnectError 
}: QuickConnectWalletProps) {
  // Track important states with minimal updates
  const [detectedWallets, setDetectedWallets] = useState<string[]>([])
  const [connecting, setConnecting] = useState(false)
  const [isClient, setIsClient] = useState(false)
  
  // Get wallet adapter state
  const { wallet, publicKey, connected, connect, select, wallets } = useWallet()
  
  // Store last connected wallet for faster reconnection
  const [lastWallet] = useLocalStorage<string | null>("lastConnectedWallet", null)

  // Fast wallet detection on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    setIsClient(true)
    
    // Detect wallets immediately without blocking rendering
    setTimeout(() => {
      const detected = []
      
      // Use type assertions to safely check for wallets
      const win = window as PhantomWindow & SolflareWindow
      
      // Detect Phantom
      if (win.phantom?.solana?.isPhantom) {
        detected.push("Phantom")
      }
      
      // Detect Solflare
      if (win.solflare?.isSolflare) {
        detected.push("Solflare")
      }
      
      if (detected.length > 0) {
        setDetectedWallets(detected)
      }
    }, 0)
  }, [])

  // Fast auto-connect if the wallet is already installed and was previously connected
  useEffect(() => {
    // Skip if no wallet is ready, or we're already connected/connecting
    if (connected || connecting || !isClient || !lastWallet || !connect || !select || !wallets.length) return
    
    // Only auto-connect if the previously connected wallet is ready
    if (isWalletReady(lastWallet)) {
      const autoConnect = async () => {
        try {
          setConnecting(true)
          if (onConnectStart) onConnectStart()
          
          // Find the wallet by name (case insensitive)
          const walletName = lastWallet.toLowerCase()
          let walletAdapter = wallets.find(w => 
            w.adapter.name.toLowerCase().includes(walletName)
          )
          
          // If not found directly, try with more flexible matching
          if (!walletAdapter) {
            walletAdapter = wallets.find(w => 
              w.adapter.name.toLowerCase().indexOf(walletName.substring(0, 4)) >= 0
            )
          }
          
          if (!walletAdapter) {
            console.log('Available wallets:', wallets.map(w => w.adapter.name))
            throw new Error(`Wallet ${lastWallet} not found`)
          }
          
          console.log(`Auto-selecting wallet: ${walletAdapter.adapter.name}`)
          
          // First select the wallet
          select(walletAdapter.adapter.name)
          
          // Add a longer delay to ensure the wallet is selected before connecting
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Then connect with multiple retries
          let retries = 0
          const maxRetries = 2
          
          while (retries <= maxRetries) {
            try {
              await connect()
              console.log('Wallet auto-connected successfully')
              break
            } catch (err) {
              retries++
              
              // Check if it's a WalletNotSelectedError
              if (err instanceof Error && err.name === 'WalletNotSelectedError') {
                console.log(`Retrying auto-connect (${retries}/${maxRetries})...`)
                
                if (retries <= maxRetries) {
                  // Try again with an even longer delay
                  await new Promise(resolve => setTimeout(resolve, 500 * retries))
                  continue
                }
              }
              
              // If we've exhausted retries or it's a different error, throw it
              throw err
            }
          }
          
          if (onConnectSuccess) onConnectSuccess()
        } catch (error) {
          console.error("Auto-connect error:", error)
          if (onConnectError && error instanceof Error) onConnectError(error)
        } finally {
          setConnecting(false)
        }
      }
      
      // Run auto-connect with minimal delay
      autoConnect()
    }
  }, [isClient, lastWallet, connected, connecting, connect, select, wallets, onConnectStart, onConnectSuccess, onConnectError])

  // Fast connect handler for specific wallet
  const connectWallet = useCallback(async (walletName: string) => {
    if (connecting || connected || !connect || !select || !wallets.length) return
    
    try {
      setConnecting(true)
      if (onConnectStart) onConnectStart()
      
      // Find the adapter by name (case insensitive matching)
      let walletAdapter = wallets.find(w => 
        w.adapter.name.toLowerCase().includes(walletName.toLowerCase())
      )
      
      // If not found directly, try with more flexible matching
      if (!walletAdapter) {
        walletAdapter = wallets.find(w => 
          w.adapter.name.toLowerCase().indexOf(walletName.toLowerCase().substring(0, 4)) >= 0
        )
      }
      
      if (!walletAdapter) {
        console.log('Available wallets:', wallets.map(w => w.adapter.name))
        throw new Error(`Wallet ${walletName} not found in available adapters`)
      }
      
      console.log(`Selecting wallet: ${walletAdapter.adapter.name}`)
      
      // First select the wallet
      select(walletAdapter.adapter.name)
      
      // Add a longer delay to ensure the wallet is selected before connecting
      // This helps prevent the WalletNotSelectedError
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Then connect with multiple retries
      let retries = 0
      const maxRetries = 2
      
      while (retries <= maxRetries) {
        try {
          await connect()
          console.log('Wallet connected successfully')
          break
        } catch (err) {
          retries++
          
          // Check if it's a WalletNotSelectedError
          if (err instanceof Error && err.name === 'WalletNotSelectedError') {
            console.log(`Retrying wallet connection (${retries}/${maxRetries})...`)
            
            if (retries <= maxRetries) {
              // Try again with an even longer delay
              await new Promise(resolve => setTimeout(resolve, 500 * retries))
              continue
            }
          }
          
          // If we've exhausted retries or it's a different error, throw it
          throw err
        }
      }
      
      if (onConnectSuccess) onConnectSuccess()
    } catch (error) {
      console.error(`Error connecting to ${walletName}:`, error)
      if (onConnectError && error instanceof Error) onConnectError(error)
    } finally {
      setConnecting(false)
    }
  }, [connecting, connected, connect, select, wallets, onConnectStart, onConnectSuccess, onConnectError])

  // Optimized rendering - only show if not connected
  if (connected || !isClient || detectedWallets.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Connect quickly:</p>
      <div className="flex gap-2">
        {detectedWallets.map((walletName) => (
          <Button
            key={walletName}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => connectWallet(walletName)}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : null}
            {walletName}
          </Button>
        ))}
      </div>
    </div>
  )
}

// Memoize for performance
export default memo(QuickConnectWallet) 