"use client"

import { Sun, Moon } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useConnection } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import WalletButton from "@/components/wallet/wallet-button"
import { useTheme } from "next-themes"
import { Card } from "@/components/ui/card"

export default function Header() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const { theme, setTheme } = useTheme()
  const [balance, setBalance] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  // After mounting, we can safely show the theme toggle
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (publicKey) {
      const fetchBalance = async () => {
        try {
          const bal = await connection.getBalance(publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
        } catch (error) {
          console.error("Error fetching balance:", error)
          setBalance(null)
        }
      }

      fetchBalance()

      // Set up interval to refresh balance
      const intervalId = setInterval(fetchBalance, 10000)

      return () => clearInterval(intervalId)
    }
  }, [publicKey, connection])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="border-b border-border py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">$</span>
          </div>
          <span className="font-medium text-lg">Solana Token Manager</span>
        </Link>

        <div className="flex items-center gap-4">
          {connected && publicKey && (
            <Card className="hidden md:flex items-center gap-2 text-sm px-3 py-1.5 bg-background border">
              <span className="text-muted-foreground">Balance:</span>
              <span className="font-medium">{balance !== null ? `${balance.toFixed(4)} SOL` : "Loading..."}</span>
            </Card>
          )}

          {mounted && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          <WalletButton className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md" />
        </div>
      </div>
    </header>
  )
}

