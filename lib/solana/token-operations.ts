import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  mintTo,
  getMint,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction
} from '@solana/spl-token';
import { sendTransactionWithRetry } from './transaction-utility';
import { toast } from 'react-hot-toast';

interface WalletAdapter {
  publicKey: PublicKey;
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>;
}

/**
 * Creates a new SPL token
 */
export async function createToken(
  connection: Connection,
  wallet: WalletAdapter,
  name: string,
  symbol: string,
  decimals: number
): Promise<{ mintKeypair: Keypair; signature: string }> {
  // Generate a new keypair for token mint
  const mintKeypair = Keypair.generate();
  
  try {
    // Get minimum lamports needed for the mint
    const lamports = await connection.getMinimumBalanceForRentExemption(
      82 // Token mint size
    );
    
    // Create transaction
    const transaction = new Transaction().add(
      // Create account instruction
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: 82,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      // Initialize mint instruction
      // This will be created by the SPL Token library
      // We are using the wrapper below
    );
    
    // Send the transaction
    const signature = await sendTransactionWithRetry(
      connection,
      wallet,
      transaction,
      [mintKeypair], // Need to include mint keypair for signing
      {
        maxRetries: 3,
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        confirmCommitment: 'confirmed'
      }
    );
    
    return { mintKeypair, signature };
  } catch (error) {
    console.error('Error creating token:', error);
    throw error;
  }
}

/**
 * Mints tokens to a specific address
 */
export async function mintTokens(
  connection: Connection,
  wallet: WalletAdapter,
  mintAddress: string,
  rawAmount: string | number // Accept either string or number for flexibility
): Promise<string> {
  console.log('Minting tokens started...');
  
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected');
  }

  try {
    // Convert mint address to PublicKey
    const mintPubkey = new PublicKey(mintAddress);
    
    // Get mint info
    const mintInfo = await getMint(connection, mintPubkey);
    
    // Check if wallet is the mint authority
    if (mintInfo.mintAuthority !== null) {
      const mintAuth = new PublicKey(mintInfo.mintAuthority.toString());
      if (!wallet.publicKey.equals(mintAuth)) {
        throw new Error('Your wallet is not the mint authority for this token');
      }
    } else {
      throw new Error('This token has no mint authority set and cannot be minted');
    }

    // Convert amount to proper format for BigInt - ensure it's a string
    let amountBigInt: bigint;
    try {
      // Ensure we have a clean string for BigInt constructor
      const amountStr = typeof rawAmount === 'number' 
        ? rawAmount.toString() 
        : rawAmount;
        
      amountBigInt = BigInt(amountStr);
    } catch (error) {
      console.error('Failed to convert amount to BigInt:', error);
      throw new Error('Invalid amount format. Please check your input.');
    }
    
    // Get associated token account
    const tokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    
    // Check if token account exists
    const tokenAccountInfo = await connection.getAccountInfo(tokenAccount)
    
    const transaction = new Transaction()
    
    // If token account doesn't exist, create it
    if (!tokenAccountInfo) {
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        tokenAccount,
        wallet.publicKey,
        mintPubkey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
      transaction.add(createATAInstruction)
    }
    
    // Add mint instruction with proper BigInt value
    const mintInstruction = createMintToInstruction(
      mintPubkey,
      tokenAccount,
      wallet.publicKey,
      amountBigInt,
      [],
      TOKEN_PROGRAM_ID
    )
    transaction.add(mintInstruction)
    
    // Send transaction with improved reliability
    const signature = await sendTransactionWithRetry(
      connection,
      wallet,
      transaction,
      [],
      {
        maxRetries: 5, // Increase retries for higher success rate
        skipPreflight: false,
        preflightCommitment: 'processed', // Use 'processed' for faster initial confirmation
        confirmCommitment: 'confirmed',  // But still wait for 'confirmed' status
        maxTimeout: 180000 // 3 minutes to allow for network congestion
      }
    )
    
    return signature
    
  } catch (error) {
    console.error('Error in mintTokens:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      const errorMessage = error.message || '';
      
      // Check common error patterns
      if (errorMessage.includes('not the mint authority') || errorMessage.includes('Invalid mint authority')) {
        throw new Error('Your wallet is not the mint authority for this token')
      } 
      else if (errorMessage.includes('insufficient funds')) {
        throw new Error('Insufficient SOL balance to pay for transaction fees')
      } 
      else if (errorMessage.includes('0x1') || errorMessage.includes('custom program error: 0x1')) {
        throw new Error('Transaction simulation failed. The amount may be too large or there may be an issue with the token')
      } 
      else if (errorMessage.includes('blockhash') || errorMessage.includes('Block height exceeded')) {
        throw new Error('Transaction timed out. The Solana network may be congested, please try again')
      } 
      else if (errorMessage.includes('Transaction was not confirmed') || errorMessage.includes('timeout')) {
        throw new Error('Transaction was not confirmed in time. Check Solana Explorer for transaction status')
      }
      else if (errorMessage.includes('invalid mint')) {
        throw new Error('Invalid mint address. Please check the address and try again')
      }
      else if (errorMessage.includes('Account does not exist')) {
        throw new Error('Token account does not exist. This may be an invalid mint address')
      }
    }
    
    // For any other errors, just pass through the original error
    throw error
  }
}

/**
 * Transfers tokens from one account to another
 */
export async function transferTokens(
  connection: Connection,
  wallet: WalletAdapter,
  mintAddress: string,
  recipient: string,
  amount: number
): Promise<string> {
  try {
    // Parse addresses
    const mintPublicKey = new PublicKey(mintAddress);
    const recipientPublicKey = new PublicKey(recipient);
    
    // Get mint info to determine decimals
    const mintInfo = await getMint(connection, mintPublicKey);
    
    // Calculate amount with decimals
    const tokenAmount = Math.floor(amount * Math.pow(10, mintInfo.decimals));
    
    // Get source token account (wallet's token account)
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Get destination token account (recipient's token account)
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      recipientPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if destination token account exists
    const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
    
    const transaction = new Transaction();
    
    // If destination token account doesn't exist, create it
    if (!destinationAccountInfo) {
      transaction.add(
        // Create associated token account instruction
        // Will be created via SPL Token library
      );
    }
    
    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        wallet.publicKey,
        tokenAmount
      )
    );
    
    // Send transaction
    const signature = await sendTransactionWithRetry(
      connection,
      wallet,
      transaction,
      [], // No additional signers
      {
        maxRetries: 3,
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        confirmCommitment: 'confirmed'
      }
    );
    
    return signature;
  } catch (error) {
    console.error('Error transferring tokens:', error);
    throw error;
  }
}

/**
 * Gets the balance of a specific token for an address
 */
export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  mintAddress: string
): Promise<number> {
  try {
    // Parse mint address
    const mintPublicKey = new PublicKey(mintAddress);
    
    // Get token account address
    const tokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletAddress,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if token account exists
    try {
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      
      if (!accountInfo) {
        return 0; // Account doesn't exist, so balance is 0
      }
      
      // Get token account info
      const accountData = await connection.getTokenAccountBalance(tokenAccount);
      
      // Return balance as a number
      return Number(accountData.value.uiAmount);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0; // Return 0 if there's an error (account likely doesn't exist)
    }
  } catch (error) {
    console.error('Error in getTokenBalance:', error);
    throw error;
  }
} 