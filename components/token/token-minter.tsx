"use client"

import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
import * as web3 from '@solana/web3.js'
import { getMint } from '@solana/spl-token'
import { Loader2, Copy, Check } from 'lucide-react'
import { Button, Label, Input, Alert, AlertTitle, AlertDescription } from '@/components/ui'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { TransactionLink } from '@/components/transaction-link'
import { useTransactionStore } from '@/lib/stores/transaction-store'
import { isMintAuthority, getTokenDecimals } from '@/lib/solana/token-helper'
import { sendTransactionWithRetry } from '@/lib/solana/transaction-utility'
import { 
  CustomToaster, 
  setToastDefaults, 
  toast, 
  toastSuccess, 
  toastError, 
  toastLoading 
} from '@/components/ui/toast'

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

export function TokenMinter() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const { addTransaction } = useTransactionStore()
  
  // Initialize toast defaults
  useEffect(() => {
    setToastDefaults()
  }, [])
  
  const [mintAddress, setMintAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [tokenDecimals, setTokenDecimals] = useState(9) // Default to 9 decimals
  const [isMintAuth, setIsMintAuth] = useState(false)
  const [copied, setCopied] = useState(false)

  // Check if connected wallet is the mint authority for the token
  useEffect(() => {
    async function checkMintAuth() {
      if (!publicKey || !mintAddress) {
        setIsMintAuth(false)
        return
      }

      try {
        const mintPubkey = new PublicKey(mintAddress)
        
        // Get mint info to check decimals
        const mintInfo = await getMint(connection, mintPubkey)
        setTokenDecimals(mintInfo.decimals)
        
        // Check mint authority
        const hasAuthority = await isMintAuthority(
          connection,
          mintAddress,
          publicKey
        )
        
        setIsMintAuth(hasAuthority)
      } catch (error) {
        console.error('Error checking mint authority:', error)
        setIsMintAuth(false)
      }
    }
    
    checkMintAuth()
  }, [mintAddress, publicKey, connection])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Copied to clipboard!")
    })
  }

  async function mintToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    if (!publicKey) {
      toastError('Please connect your wallet', { id: `wallet-connect-error-${Date.now()}` })
      return
    }

    if (!mintAddress) {
      toastError('Please enter a mint address', { id: `mint-address-error-${Date.now()}` })
      return
    }

    if (!isMintAuth) {
      toastError('Your wallet is not the mint authority for this token', { id: `mint-auth-error-${Date.now()}` })
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toastError('Please enter a valid amount greater than 0', { id: `amount-error-${Date.now()}` })
      return
    }

    setIsLoading(true)
    setSignature(null)

    try {
      // Show loading toast with ID to dismiss it later
      const loadingToast = toastLoading('Preparing to mint tokens...', { id: `mint-loading-${Date.now()}` })

      // Get mint info and validate
      const mintPubkey = new PublicKey(mintAddress)
      
      // Update loading message
      toastLoading('Creating transaction...', { id: loadingToast })

      // Import and mint tokens
      const { mintTokens } = await import('@/lib/solana/token-operations')
      
      // Calculate exact amount with decimal places
      // This is critical for proper token minting
      const decimalMultiplier = Math.pow(10, tokenDecimals)
      const rawAmount = Math.floor(amountNum * decimalMultiplier)

      // Update loading message for transaction
      toastLoading('Please approve the transaction in your wallet...', { id: loadingToast })

      const sig = await mintTokens(
        connection,
        {
          publicKey,
          sendTransaction,
        },
        mintAddress,
        rawAmount
      )

      // Update loading message for confirmation
      toastLoading('Confirming transaction...', { id: loadingToast })

      // Update state
      setSignature(sig)
      
      // Add to transaction history
      addTransaction({
        id: sig,
        type: 'mint',
        tokenName: null,
        tokenSymbol: null,
        amount: amountNum,
        mintAddress: mintAddress,
        recipient: publicKey.toString(),
        timestamp: Date.now(),
        status: 'success',
      })

      // Clear loading toast and show success
      toast.dismiss(loadingToast)
      toastSuccess('Tokens minted successfully!', { id: `mint-success-${Date.now()}` })
      
      // Reset amount field
      setAmount("")
      
    } catch (error) {
      console.error('Error minting token:', error)
      
      // Show error toast with better styling
      toastError(
        error instanceof Error ? error.message : 'Failed to mint tokens', 
        { id: `mint-error-${Date.now()}` }
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mint Tokens</CardTitle>
        <CardDescription>
          Mint additional tokens to an existing SPL token
        </CardDescription>
      </CardHeader>
      <CardContent>
        {publicKey && mintAddress && !isMintAuth && (
          <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900">
            <AlertTitle className="text-red-600 dark:text-red-400">Warning!</AlertTitle>
            <AlertDescription className="text-red-600 dark:text-red-400">
              Your wallet is not the mint authority for this token. You cannot mint new tokens.
            </AlertDescription>
          </Alert>
        )}
        
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
              placeholder="Enter amount to mint"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0"
              step="any"
            />
            {tokenDecimals !== 9 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Token has {tokenDecimals} decimals
              </p>
            )}
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !publicKey || !mintAddress || !isMintAuth || !amount || parseFloat(amount) <= 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Minting...
              </>
            ) : (
              'Mint Tokens'
            )}
          </Button>
        </form>

        {signature && (
          <div className="mt-4 p-3 border rounded-md bg-green-50 dark:bg-green-900 dark:border-green-800 text-xs">
            <div className="flex justify-between items-center mb-1">
              <p className="font-medium text-green-800 dark:text-green-400">Transaction submitted:</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-green-800 dark:text-green-400"
                onClick={() => copyToClipboard(signature)}
              >
                {copied ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                Copy
              </Button>
            </div>
            <TransactionLink signature={signature} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

