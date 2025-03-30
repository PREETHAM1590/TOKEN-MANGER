"use client"
import Header from "@/components/header"
import WalletConnect from "@/components/wallet/wallet-connect"
import { useWallet } from "@solana/wallet-adapter-react"
import TokenCreator from "@/components/token/token-creator"
import { TokenMinter } from "@/components/token/token-minter"
import TokenSender from "@/components/token/token-sender"
import TransactionHistory from "@/components/transaction-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const { connected } = useWallet()

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {!connected ? (
          <div className="flex flex-col items-center justify-center h-[80vh]">
            <WalletConnect />
          </div>
        ) : (
          <div className="space-y-8">
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid grid-cols-3 mb-8">
                <TabsTrigger value="create">Create Token</TabsTrigger>
                <TabsTrigger value="mint">Mint Token</TabsTrigger>
                <TabsTrigger value="send">Send Token</TabsTrigger>
              </TabsList>
              <TabsContent value="create">
                <TokenCreator />
              </TabsContent>
              <TabsContent value="mint">
                <TokenMinter />
              </TabsContent>
              <TabsContent value="send">
                <TokenSender />
              </TabsContent>
            </Tabs>

            <TransactionHistory />
          </div>
        )}
      </div>
    </main>
  )
}

