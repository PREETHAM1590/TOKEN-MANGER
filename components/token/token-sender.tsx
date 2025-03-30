"use client"

import type React from "react"

import { useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import toast from "react-hot-toast"
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

  const sendToken = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    try {
      setIsLoading(true)
      setTxSignature(null)

      // Parse addresses
      const mintPublicKey = new PublicKey(mintAddress)
      const recipientPublicKey = new PublicKey(recipientAddress)

      // Validate the mint
      try {
        await connection.getTokenSupply(mintPublicKey)
      } catch (error) {
        toast.error("Invalid mint address. Please verify the address is correct.")
        setIsLoading(false)
        return
      }

      toast.loading("Setting up token accounts...")

      // Get or create token accounts using our helper
      const senderTokenAccount = await token.getAssociatedTokenAddress(
        mintPublicKey,
        publicKey,
        false,
        token.TOKEN_PROGRAM_ID,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
      )

      // Check if sender token account exists
      const senderAccountInfo = await connection.getAccountInfo(senderTokenAccount)
      if (!senderAccountInfo) {
        toast.error("You don't have any of these tokens in your wallet.")
        setIsLoading(false)
        return
      }

      // Get or create recipient token account
      const recipientTokenAccount = await token.getAssociatedTokenAddress(
        mintPublicKey,
        recipientPublicKey,
        false,
        token.TOKEN_PROGRAM_ID,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
      )

      // Create a transaction
      const transaction = new web3.Transaction()

      // Check if recipient token account exists and create if needed
      const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount)
      if (!recipientAccountInfo) {
        // Create associated token account for recipient
        transaction.add(
          token.createAssociatedTokenAccountInstruction(
            publicKey,
            recipientTokenAccount,
            recipientPublicKey,
            mintPublicKey,
            token.TOKEN_PROGRAM_ID,
            token.ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }

      // Create transfer instruction
      transaction.add(
        token.createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          publicKey,
          BigInt(Math.floor(Number.parseFloat(amount) * Math.pow(10, 9))), // Assuming 9 decimals
          [],
          token.TOKEN_PROGRAM_ID
        )
      )

      // Send transaction using our utility with retries for blockhash expiration
      const signature = await sendTransactionWithRetry(
        connection,
        { publicKey, sendTransaction },
        transaction,
        [], // No additional signers needed
        {
          maxRetries: 3,
          skipPreflight: false,
          preflightCommitment: 'confirmed', 
          confirmCommitment: 'confirmed',
          maxTimeout: 90000 // 90 seconds
        }
      )

      // Set transaction signature
      setTxSignature(signature)

      // Add to transaction history
      addTransaction({
        id: signature,
        type: "send",
        tokenName: "Unknown", // We don't have token metadata here
        tokenSymbol: "Unknown",
        amount: Number.parseFloat(amount),
        mintAddress: mintAddress,
        recipient: recipientAddress,
        timestamp: Date.now(),
        status: "success",
      })

    } catch (error) {
      console.error("Error sending tokens:", error)
      toast.error(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
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
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm font-medium text-green-800">Tokens sent successfully!</p>
            <p className="text-xs text-green-700 mt-1">Transaction Signature:</p>
            <p className="text-xs font-mono bg-white p-2 rounded border mt-1 break-all">{txSignature}</p>
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:underline mt-2 inline-block"
            >
              View on Solana Explorer
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

