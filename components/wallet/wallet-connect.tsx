"use client"

import { WalletIcon } from "lucide-react"
import WalletButton from "@/components/wallet/wallet-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function WalletConnect() {
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
        <div className="flex justify-center mb-6">
          <WalletButton className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors rounded-md py-2 px-6 shadow-sm" />
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          Note: This app uses the Solana Devnet. Make sure your wallet is configured for Devnet.
        </p>
      </CardContent>
    </Card>
  )
}

