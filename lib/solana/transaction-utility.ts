import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SendOptions,
  TransactionSignature,
  VersionedTransaction,
  Keypair,
  TransactionMessage,
  TransactionInstruction
} from '@solana/web3.js';
import { toast } from 'react-hot-toast';

interface SendTransactionOptions {
  maxRetries?: number;
  skipPreflight?: boolean;
  preflightCommitment?: string;
  confirmCommitment?: string;
  maxTimeout?: number;
}

/**
 * A robust transaction sender with automatic retries for blockhash expiration.
 * This function properly manages blockhash refreshes and automatically retries
 * when transactions fail due to block height exceeded errors.
 */
export async function sendTransactionWithRetry(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (transaction: Transaction, connection: Connection, options?: SendOptions) => Promise<string>;
  },
  transaction: Transaction,
  signers: Keypair[] = [],
  options: SendTransactionOptions = {}
): Promise<string> {
  const {
    maxRetries = 3,
    skipPreflight = false,
    preflightCommitment = 'confirmed',
    confirmCommitment = 'confirmed',
    maxTimeout = 120000 // 2 minutes
  } = options;
  
  let signature = '';
  let attempt = 0;
  let success = false;
  let lastError: Error | null = null;
  
  const loadingToast = toast.loading('Preparing transaction...');
  
  while (attempt < maxRetries && !success) {
    try {
      attempt++;
      console.log(`Transaction attempt ${attempt}/${maxRetries}`);
      
      // Get fresh blockhash using finalized commitment for maximum reliability
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
        commitment: 'finalized' // Always use finalized for blockhash to prevent rapid expiration
      });

      // Update transaction with fresh blockhash
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      
      // Always set fee payer
      transaction.feePayer = wallet.publicKey;
      
      // Re-sign the transaction with the provided signers if any
      if (signers.length > 0) {
        transaction.sign(...signers);
      }
      
      toast.dismiss(loadingToast);
      toast.loading(`Please approve transaction in your wallet (Attempt ${attempt}/${maxRetries})...`);
      
      // Send the transaction
      signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight,
        preflightCommitment: preflightCommitment as any,
        maxRetries: 5 // Internal retries for network issues
      });
      
      console.log(`Transaction sent with signature ${signature}`);
      
      toast.dismiss(loadingToast);
      const confirmToast = toast.loading(`Confirming transaction... Please wait.`);
      
      // Create confirmation promise with timeout
      const confirmationPromise = new Promise<boolean>((resolve, reject) => {
        // Set confirmation timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Transaction confirmation timeout'));
        }, maxTimeout);
        
        // Start watching for confirmation
        (async () => {
          try {
            // Proper typesafe confirmation strategy
            const confirmationStrategy = {
              signature,
              blockhash,
              lastValidBlockHeight
            };
            
            const confirmation = await connection.confirmTransaction(
              confirmationStrategy, 
              confirmCommitment as any
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
      
      // If we get here, transaction was successful
      success = true;
      toast.dismiss(confirmToast);
      toast.success('Transaction confirmed successfully!');
      
      return signature;
    } catch (error: any) {
      lastError = error;
      console.error(`Transaction attempt ${attempt} failed:`, error);
      
      // Check if this is a blockhash-related error that we can retry
      const isBlockhashError = 
        error.message?.includes('block height exceeded') || 
        error.message?.includes('blockhash not found') ||
        error.message?.includes('invalid blockhash');
        
      // If we have more retries and it's a blockhash error, retry
      if (attempt < maxRetries && isBlockhashError) {
        toast.dismiss(loadingToast);
        toast.loading(`Transaction expired. Retrying with fresh blockhash (${attempt}/${maxRetries})...`);
        
        // Add exponential backoff between retries
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Continue to next retry
      } else {
        // Either we're out of retries or it's not a retryable error
        toast.dismiss(loadingToast);
        toast.error(getErrorMessage(error));
        throw error;
      }
    }
  }
  
  // If we reach here, we've exhausted all retries
  toast.dismiss(loadingToast);
  throw lastError || new Error('Transaction failed for unknown reason');
}

/**
 * Simplified version for when you just want to send instructions without worrying
 * about manually creating a transaction
 */
export async function sendInstructions(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (transaction: Transaction, connection: Connection, options?: SendOptions) => Promise<string>;
  },
  instructions: TransactionInstruction[],
  signers: Keypair[] = [],
  options: SendTransactionOptions = {}
): Promise<string> {
  // Create a new transaction
  const transaction = new Transaction();
  
  // Add all instructions
  transaction.add(...instructions);
  
  // Send with our retry mechanism
  return sendTransactionWithRetry(connection, wallet, transaction, signers, options);
}

/**
 * Extracts a user-friendly error message from transaction errors
 */
export function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  const message = error.message || error.toString();
  
  // Extract specific error messages
  if (message.includes('block height exceeded')) {
    return 'Transaction took too long to confirm. Please try again.';
  } else if (message.includes('blockhash not found')) {
    return 'Transaction expired. Please try again.';
  } else if (message.includes('insufficient funds')) {
    return 'Insufficient funds for transaction.';
  } else if (message.includes('rejected')) {
    return 'Transaction rejected by user.';
  } else if (message.includes('user rejected')) {
    return 'You declined the transaction. Please try again.';
  } else if (message.includes('already in use')) {
    return 'This transaction was already processed.';
  } else if (message.includes('invalid account owner')) {
    return 'Invalid account owner.';
  } else if (message.toLowerCase().includes('timeout')) {
    return 'Network timeout. Solana may be congested, please try again.';
  }
  
  // Return a more generic message if we can't identify the specific error
  return `Transaction error: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`;
} 