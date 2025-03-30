"use client"

import type React from "react"

import { useState } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import * as web3 from "@solana/web3.js"
import * as token from "@solana/spl-token"
import { PublicKey, Connection } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import toast from "react-hot-toast"
import { useTransactionStore } from "@/lib/stores/transaction-store"
import { doesTokenAccountExist } from "@/lib/solana/token-helper"
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token"

/**
 * Confirm a transaction with exponential backoff retry strategy for better reliability
 */
async function confirmTransactionWithExponentialBackoff(
  connection: Connection,
  signature: string,
  timeoutMs: number = 90000
): Promise<web3.RpcResponseAndContext<web3.SignatureResult>> {
  const startTime = Date.now();
  
  let done = false;
  let retries = 0;
  let confirmResult: web3.RpcResponseAndContext<web3.SignatureResult> | null = null;
  
  // Keep polling until timeout
  while (!done && Date.now() - startTime < timeoutMs) {
    try {
      // For each attempt, use a simple status check rather than blockhash verification
      // This avoids the expired blockhash issue
      confirmResult = await connection.confirmTransaction(signature, 'confirmed');
      
      // If we got a result, we're done
      done = true;
    } catch (error) {
      // If we hit an error, increment retry counter but continue
      console.log(`Confirmation attempt ${retries + 1} failed:`, error);
    }
    
    if (!done) {
      // Exponential backoff with a minimum of 1s and max of 10s
      const delay = Math.min(1000 * Math.pow(1.5, retries), 10000);
      retries++;
      console.log(`Waiting ${delay}ms before retry ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  if (confirmResult === null) {
    throw new Error(`Transaction confirmation timed out after ${timeoutMs}ms`);
  }
  
  return confirmResult;
}

export default function TokenMinter() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const { addTransaction } = useTransactionStore()

  const [mintAddress, setMintAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)

  const mintToken = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!publicKey) {
      toast.error("Wallet not connected")
      return
    }

    try {
      setIsLoading(true)
      setTxSignature(null)
      
      // Validate input
      if (!mintAddress || !amount || parseFloat(amount) <= 0) {
        toast.error("Please enter a valid mint address and amount")
        setIsLoading(false)
        return
      }

      // Parse mint address
      let mintPublicKey: PublicKey
      try {
        mintPublicKey = new PublicKey(mintAddress)
      } catch (error) {
        toast.error("Invalid mint address format")
        setIsLoading(false)
        return
      }
      
      // Validate the mint
      try {
        await connection.getTokenSupply(mintPublicKey)
      } catch (error) {
        toast.error("Invalid mint address. Please verify the address is correct.")
        setIsLoading(false)
        return
      }

      // Get associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPublicKey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      // Check if token account exists
      const accountExists = await doesTokenAccountExist(
        connection, 
        mintPublicKey, 
        publicKey
      )

      // Create a new transaction
      const transaction = new web3.Transaction()
      
      // If token account doesn't exist, add instruction to create it
      if (!accountExists) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            associatedTokenAddress,
            publicKey,
            mintPublicKey,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        )
      }

      // Add mint instruction
      const amountToMint = BigInt(Math.floor(Number.parseFloat(amount) * Math.pow(10, 9))) // Assuming 9 decimals
      
      transaction.add(
        token.createMintToInstruction(
          mintPublicKey,
          associatedTokenAddress,
          publicKey,
          amountToMint,
          [],
          token.TOKEN_PROGRAM_ID
        )
      )

      // Get a fresh blockhash right before sending
      // This ensures we have the most current blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Send transaction through wallet adapter
      const loadingToast = toast.loading(accountExists ? 'Minting tokens...' : 'Creating account and minting tokens...')
      
      // Let the wallet handle the signing with better preflight and commitment settings
      const signature = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'finalized', // Use stronger commitment level
        maxRetries: 5 // Add retries for sending
      })
      
      // Wait for confirmation
      toast.dismiss(loadingToast)
      const confirmToast = toast.loading('Confirming transaction...')
      
      try {
        // Use a simpler confirmation approach that is less susceptible to blockhash expiration
        const confirmationResult = await confirmTransactionWithExponentialBackoff(
          connection,
          signature,
          90000 // 90 seconds timeout
        );
        
        toast.dismiss(confirmToast);
        
        if (confirmationResult.value.err) {
          throw new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmationResult.value.err)}`);
        }
        
        // Set transaction signature
        setTxSignature(signature);
        
        // Add to transaction history
        addTransaction({
          id: signature,
          type: "mint",
          tokenName: "Unknown", // We don't have token metadata here
          tokenSymbol: "Unknown",
          amount: Number.parseFloat(amount),
          mintAddress: mintAddress,
          recipient: publicKey.toString(),
          timestamp: Date.now(),
          status: "success",
        });
        
        toast.success("Tokens minted successfully!");
        
        // Clear the form
        setAmount("");
      } catch (err) {
        toast.dismiss(confirmToast);
        
        // Check if this is a timeout error
        if (err instanceof Error && err.message.includes('timeout')) {
          toast.custom(
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-md px-4 py-3">
              <p className="text-amber-800 dark:text-amber-300 font-medium">Transaction may have succeeded, but confirmation timed out.</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-2">Check the transaction in Solana Explorer:</p>
              <a
                href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
              >
                View transaction {signature.slice(0, 8)}...
              </a>
            </div>,
            { duration: 10000 }
          );
          
          // Still set the signature so user can check it
          setTxSignature(signature);
        } else {
          // For other errors
          throw err;
        }
      }
    } catch (error) {
      console.error("Error minting tokens:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      toast.error(`Failed to mint tokens: ${errorMessage.includes("User") ? "User rejected transaction" : errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mint Tokens</CardTitle>
        <CardDescription>Mint new tokens to your wallet</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={mintToken} className="space-y-4">
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
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Minting...
              </>
            ) : (
              "Mint Tokens"
            )}
          </Button>
        </form>

        {txSignature && (
          <Alert className="mt-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900">
            <AlertTitle className="text-green-600 dark:text-green-400">Transaction Successful!</AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-400">
              Transaction Signature:
              <code className="relative rounded bg-green-100 dark:bg-green-900/50 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-green-900 dark:text-green-400 block mt-2 truncate">
                {txSignature}
              </code>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
              >
                View on Solana Explorer
              </a>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

