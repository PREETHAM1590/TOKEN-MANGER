"use client"

import type React from "react"

import { useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import { Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  toastSuccess, 
  toastError, 
  toastLoading,
  toast
} from '@/components/ui/toast'
import { useTransactionStore } from "@/lib/stores/transaction-store"
import { sendTransactionWithRetry, getErrorMessage } from "@/lib/solana/transaction-utility"
import { getOrCreateAssociatedTokenAccount } from "@/lib/solana/token-helper"

export default function TokenSender() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const { addTransaction } = useTransactionStore()

  const [mintAddress, setMintAddress] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const sendToken = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!publicKey) {
      toastError('Please connect your wallet', { id: 'wallet-connect-error' })
      return
    }

    if (!mintAddress) {
      toastError('Please enter a mint address', { id: 'mint-address-error' })
      return
    }

    if (!recipientAddress) {
      toastError('Please enter a recipient address', { id: 'recipient-address-error' })
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toastError('Please enter a valid amount greater than 0', { id: 'amount-error' })
      return
    }

    let pubkey: PublicKey
    try {
      pubkey = new PublicKey(recipientAddress)
    } catch (error) {
      toastError('Invalid recipient address', { id: 'invalid-address-error' })
      return
    }

    setIsLoading(true)
    setTxSignature(null)

    try {
      // Show loading toast with ID
      const loadingToast = toastLoading('Preparing to send tokens...', { id: 'send-loading' })

      // Import dynamically to reduce initial load time
      const { transferTokens } = await import('@/lib/solana/token-operations')

      // Update loading toast
      toastLoading('Creating transaction...', { id: loadingToast })

      // Get the token decimals
      const { getMint } = await import('@solana/spl-token')
      const mintInfo = await getMint(connection, new PublicKey(mintAddress))
      
      // Update loading toast
      toastLoading('Please approve the transaction in your wallet...', { id: loadingToast })

      // Send tokens
      const sig = await transferTokens(
        connection,
        {
          publicKey,
          sendTransaction,
        },
        mintAddress,
        recipientAddress,
        amountNum
      )

      // Update loading toast
      toastLoading('Confirming transaction...', { id: loadingToast })

      // Update state with transaction signature
      setTxSignature(sig)
      
      // Add to transaction history
      addTransaction({
        id: sig,
        type: 'send',
        tokenName: null,
        tokenSymbol: null,
        amount: amountNum,
        mintAddress: mintAddress,
        recipient: recipientAddress,
        timestamp: Date.now(),
        status: 'success',
      })

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast)
      toastSuccess('Tokens sent successfully!', { id: 'send-success' })
      
      // Reset amount field
      setAmount("")
      
    } catch (error) {
      console.error('Error sending token:', error)
      toastError(
        error instanceof Error ? error.message : 'Failed to send tokens', 
        { id: 'send-error' }
      )
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
      toast.success("Copied to clipboard!")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Tokens</CardTitle>
        <CardDescription>Send tokens to another wallet</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={sendToken} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mintAddress">Token Mint Address</Label>
            <Input
              id="mintAddress"
              placeholder="Enter token mint address"
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientAddress">Recipient Address</Label>
            <Input
              id="recipientAddress"
              placeholder="Enter recipient wallet address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              min="0"
              placeholder="1.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Tokens"}
          </Button>
        </form>

        {txSignature && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md dark:bg-green-950 dark:border-green-900">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-green-800 dark:text-green-400">Tokens sent successfully!</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-green-800 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900"
                onClick={() => copyToClipboard(txSignature)}
              >
                {copied ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Copy
              </Button>
            </div>
            <p className="text-xs text-green-700 dark:text-green-500 mt-1">Transaction Signature:</p>
            <p className="text-xs font-mono bg-white dark:bg-green-900/50 p-2 rounded border mt-1 break-all text-green-900 dark:text-green-400">{txSignature}</p>
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-2 inline-block"
            >
              View on Solana Explorer
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

