import { Connection, PublicKey, Transaction, SendOptions, Commitment, TransactionSignature } from '@solana/web3.js';
import { toast } from 'react-hot-toast';

// Default timeout settings - increased for reliability
const DEFAULT_TIMEOUT = 60000; // 60 seconds (up from 30)
const DEFAULT_PREFLIGHT = false; // Skip preflight for faster transactions
const DEFAULT_COMMITMENT = 'confirmed';
const DEFAULT_MAX_RETRIES = 3;

interface TransactionOptions {
  commitment?: Commitment;
  maxRetries?: number;
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxTimeout?: number;
}

/**
 * Send and confirm a transaction with proper error handling and retry logic
 */
export async function sendAndConfirmTransaction(
  connection: Connection,
  transaction: Transaction,
  signers: Array<{ publicKey: PublicKey; secretKey: Uint8Array }>,
  options: TransactionOptions = {}
): Promise<string> {
  const {
    commitment = DEFAULT_COMMITMENT,
    maxRetries = DEFAULT_MAX_RETRIES,
    skipPreflight = DEFAULT_PREFLIGHT,
    preflightCommitment = 'processed',
    maxTimeout = DEFAULT_TIMEOUT
  } = options;

  let signature: TransactionSignature = '';
  let attempt = 0;
  let lastError: Error | null = null;

  // Adding a loading toast
  const loadingToast = toast.loading('Processing transaction...');

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`Transaction attempt ${attempt}/${maxRetries}`);

      // Get fresh blockhash using finalized commitment for maximum reliability
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      
      // Set recent blockhash and fee payer for each attempt
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = signers[0].publicKey;
      
      // Reset signatures in case of retry
      transaction.signatures = [];
      
      // Sign transaction
      transaction = Transaction.from(transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }));
      
      signers.forEach(signer => {
        transaction.partialSign({
          publicKey: signer.publicKey,
          secretKey: signer.secretKey
        });
      });

      // Send transaction
      const sendOptions: SendOptions = {
        skipPreflight,
        preflightCommitment,
      };
      
      signature = await connection.sendRawTransaction(transaction.serialize(), sendOptions);
      
      toast.dismiss(loadingToast);
      const confirmToast = toast.loading('Confirming transaction... Please wait.');
      
      // Confirm transaction with increased timeout for reliability
      const confirmationPromise = new Promise<boolean>((resolve, reject) => {
        // Set confirmation timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Transaction confirmation timeout'));
        }, maxTimeout);
        
        // Start watching for confirmation
        (async () => {
          try {
            // Create proper confirmation strategy
            const confirmationStrategy = {
              signature,
              blockhash,
              lastValidBlockHeight
            };
            
            const confirmation = await connection.confirmTransaction(
              confirmationStrategy, 
              commitment
            );
            
            clearTimeout(timeoutId);
            
            if (confirmation.value.err) {
              reject(new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`));
            } else {
              resolve(true);
            }
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        })();
      });
      
      // Wait for confirmation
      await confirmationPromise;
      
      // Success! Clear the loading toast and show success message
      toast.dismiss(confirmToast);
      toast.success('Transaction confirmed successfully!');
      
      console.log(`Transaction successful! Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      lastError = error;
      console.error(`Transaction attempt ${attempt} failed:`, error);
      
      // Handle specific errors
      const isBlockhashError = 
        error.message?.includes('block height exceeded') || 
        error.message?.includes('blockhash not found') ||
        error.message?.includes('invalid blockhash');
        
      if (isBlockhashError && attempt < maxRetries) {
        console.log('Blockhash error, retrying with new blockhash...');
        toast.dismiss(loadingToast);
        toast.loading(`Transaction expired. Retrying with fresh blockhash (${attempt}/${maxRetries})...`);
        
        // Exponential backoff between retries
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Continue to retry
      } else if (error.message?.includes('Token Account not found')) {
        // Don't retry as this needs intervention
        toast.dismiss(loadingToast);
        toast.error('Token account not found. Account may need to be created first.');
        throw error;
      } else if (error.message?.includes('insufficient funds')) {
        // Don't retry as this needs intervention
        toast.dismiss(loadingToast);
        toast.error('Insufficient funds for transaction.');
        throw error;
      } else if (attempt >= maxRetries) {
        // Give up after max retries
        toast.dismiss(loadingToast);
        toast.error(`Transaction failed after ${maxRetries} attempts.`);
        throw error;
      } else {
        // Some other error we can't handle, give up
        toast.dismiss(loadingToast);
        toast.error(getSolanaErrorMessage(error));
        throw error;
      }
    }
  }

  // This should not happen if the loop works properly
  toast.dismiss(loadingToast);
  throw lastError || new Error('Transaction failed for unknown reason');
}

/**
 * Check if a token account exists, create it if necessary
 */
export async function ensureTokenAccount(
  connection: Connection,
  tokenMint: PublicKey,
  owner: PublicKey,
  payer: { publicKey: PublicKey; secretKey: Uint8Array },
  createIfMissing: boolean = true
): Promise<PublicKey | null> {
  try {
    // Logic to check and create token account
    // This is a placeholder - you would implement the actual logic using @solana/spl-token
    // Return the token account address if successful
    return null;
  } catch (error) {
    console.error('Error ensuring token account:', error);
    toast.error('Failed to set up token account');
    return null;
  }
}

/**
 * Extract a user-friendly error message from Solana errors
 */
export function getSolanaErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  const message = error.message || error.toString();
  
  // Extract specific error messages
  if (message.includes('block height exceeded')) {
    return 'Transaction expired. Please try again.';
  } else if (message.includes('Token Account not found')) {
    return 'Token account not found. It may need to be created first.';
  } else if (message.includes('insufficient funds')) {
    return 'Insufficient funds for transaction.';
  } else if (message.includes('rejected')) {
    return 'Transaction rejected by user.';
  } else if (message.includes('This transaction has already been processed')) {
    return 'This transaction was already processed.';
  } else if (message.includes('invalid account owner')) {
    return 'Invalid account owner.';
  } else if (message.toLowerCase().includes('timeout')) {
    return 'Transaction timed out. Network may be congested.';
  }
  
  // Return a more generic message if we can't identify the specific error
  return `Transaction error: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`;
} 