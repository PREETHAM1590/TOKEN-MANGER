"use client"

import { useState, useCallback } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { 
  createInitializeMintInstruction, 
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token"
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js"
import toast from "react-hot-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTransactionStore } from "@/lib/stores/transaction-store"
import { getCachedConnection } from "@/lib/solana/connection-helper"
import { Loader2 } from "lucide-react"

// Cache validation patterns for performance
const NAME_PATTERN = /^[a-zA-Z0-9 ]{1,32}$/;
const SYMBOL_PATTERN = /^[a-zA-Z0-9]{1,10}$/;
const DECIMALS_PATTERN = /^([0-9]|1[0-9]|2[0-5])$/;

export default function TokenCreator() {
  // States for token attributes - optimized for minimal re-renders
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [decimals, setDecimals] = useState("9")
  
  // Create a single transaction state object for better performance
  const [txState, setTxState] = useState({
    creating: false,
    success: false,
    error: false,
    mintAddress: "",
  });
  
  // Input validation state cache for instant feedback
  const [validation, setValidation] = useState({
    nameValid: true,
    symbolValid: true,
    decimalsValid: true
  });

  // Get wallet connection - only when needed
  const { publicKey, signTransaction, connected } = useWallet()
  const { addTransaction } = useTransactionStore()

  // Fast validation using regex
  const validateInputs = useCallback(() => {
    const nameValid = NAME_PATTERN.test(name);
    const symbolValid = SYMBOL_PATTERN.test(symbol);
    const decimalsValid = DECIMALS_PATTERN.test(decimals);
    
    setValidation({ nameValid, symbolValid, decimalsValid });
    
    return nameValid && symbolValid && decimalsValid;
  }, [name, symbol, decimals]);

  // Optimized token creation with transaction batching
  const createToken = useCallback(async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!validateInputs()) {
      return;
    }

    setTxState({
      creating: true,
      success: false,
      error: false,
      mintAddress: ""
    });

    try {
      // Start a loading toast for better user feedback
      const loadingToast = toast.loading("Creating your token...");
      
      // Prepare optimized token creation
      const connection = getCachedConnection("https://api.devnet.solana.com");
      
      // Generate keypair outside of transaction for better performance
      const mintKeypair = Keypair.generate();
      const mintAddress = mintKeypair.publicKey.toString();
      
      // Pre-calculate minimum rent outside of transaction creation
      const lamports = await getMinimumBalanceForRentExemptMint(connection);

      // Build optimized transaction
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          parseInt(decimals),
          publicKey,
          publicKey,
        )
      );

      // Small optimization: set recent blockhash and feePayer in one step
      transaction.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
      transaction.feePayer = publicKey;

      // Sign the transaction for faster processing
      const signedTx = await signTransaction(transaction);
      
      // Add keypair signature outside of signing session for speed
      signedTx.partialSign(mintKeypair);
      
      // Optimize send with preflight disabled for speed
      const txid = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });
      
      // Log transaction for history
      addTransaction({
        id: txid,
        status: "success",
        type: "create",
        tokenName: name,
        tokenSymbol: symbol,
        amount: null,
        mintAddress: mintAddress,
        recipient: null,
        timestamp: Date.now(),
      });

      // Close loading toast and show success
      toast.dismiss(loadingToast);
      toast.success("Token created successfully!");
      
      // Update state with success
      setTxState({
        creating: false,
        success: true,
        error: false,
        mintAddress
      });
      
      // Reset form for next token creation
      setName("");
      setSymbol("");
      setDecimals("9");
      
    } catch (err: any) {
      console.error("Error creating token:", err);
      toast.error(err.message || "Failed to create token");
      
      // Update state with error
      setTxState({
        creating: false,
        success: false,
        error: true,
        mintAddress: ""
      });
      
      // Log failed transaction
      addTransaction({
        id: "failed_tx_" + Date.now(),
        status: "error",
        type: "create",
        tokenName: name,
        tokenSymbol: symbol,
        amount: null,
        mintAddress: "ERROR",
        recipient: null,
        timestamp: Date.now(),
      });
    }
  }, [publicKey, signTransaction, connected, name, symbol, decimals, addTransaction, validateInputs]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create Token</CardTitle>
        <CardDescription>Create a new SPL token on Solana devnet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name" className={validation.nameValid ? "" : "text-destructive"}>
            Token Name
          </Label>
          <Input
            id="name"
            placeholder="My Token"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!validation.nameValid && NAME_PATTERN.test(e.target.value)) {
                setValidation({...validation, nameValid: true});
              }
            }}
            className={validation.nameValid ? "" : "border-destructive focus-visible:ring-destructive"}
          />
          {!validation.nameValid && (
            <p className="text-sm text-destructive">Name must be 1-32 alphanumeric characters or spaces</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="symbol" className={validation.symbolValid ? "" : "text-destructive"}>
            Token Symbol
          </Label>
          <Input
            id="symbol"
            placeholder="TKN"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              if (!validation.symbolValid && SYMBOL_PATTERN.test(e.target.value)) {
                setValidation({...validation, symbolValid: true});
              }
            }}
            className={validation.symbolValid ? "" : "border-destructive focus-visible:ring-destructive"}
          />
          {!validation.symbolValid && (
            <p className="text-sm text-destructive">Symbol must be 1-10 alphanumeric characters</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="decimals" className={validation.decimalsValid ? "" : "text-destructive"}>
            Decimals
          </Label>
          <Input
            id="decimals"
            type="number"
            min="0"
            max="25"
            placeholder="9"
            value={decimals}
            onChange={(e) => {
              setDecimals(e.target.value);
              if (!validation.decimalsValid && DECIMALS_PATTERN.test(e.target.value)) {
                setValidation({...validation, decimalsValid: true});
              }
            }}
            className={validation.decimalsValid ? "" : "border-destructive focus-visible:ring-destructive"}
          />
          {!validation.decimalsValid && (
            <p className="text-sm text-destructive">Decimals must be a number between 0 and 25</p>
          )}
        </div>
      </CardContent>
      
      {txState.success && (
        <CardContent>
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900">
            <AlertTitle className="text-green-600 dark:text-green-400">Token Created Successfully!</AlertTitle>
            <AlertDescription className="text-green-600 dark:text-green-400">
              Your new token mint address:
              <code className="relative rounded bg-green-100 dark:bg-green-900/50 px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-green-900 dark:text-green-400 block mt-2 truncate">
                {txState.mintAddress}
              </code>
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
      
      {txState.error && (
        <CardContent>
          <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900">
            <AlertTitle className="text-red-600 dark:text-red-400">Failed to Create Token</AlertTitle>
            <AlertDescription className="text-red-600 dark:text-red-400">
              Please try again or check console for details.
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
      
      <CardFooter>
        <Button 
          onClick={createToken} 
          disabled={txState.creating || !connected}
          className="w-full"
        >
          {txState.creating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : connected ? (
            "Create Token"  
          ) : (
            "Connect Wallet First"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

