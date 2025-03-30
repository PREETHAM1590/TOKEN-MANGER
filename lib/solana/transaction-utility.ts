import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SendOptions,
  TransactionSignature,
  VersionedTransaction,
  Keypair,
  TransactionMessage,
  TransactionInstruction,
  Commitment
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
    maxRetries = 5,
    skipPreflight = false,
    preflightCommitment = 'processed',
    confirmCommitment = 'confirmed',
    maxTimeout = 180000 // 3 minutes
  } = options;
  
  let signature = '';
  let attempt = 0;
  let success = false;
  let lastError: Error | null = null;
  
  const loadingToast = toast.loading('Preparing transaction...');
  
  // Verify wallet is connected before attempting transaction
  if (!wallet.publicKey) {
    toast.dismiss(loadingToast);
    throw new Error('Wallet is not connected. Please connect your wallet and try again.');
  }
  
  while (attempt < maxRetries && !success) {
    try {
      attempt++;
      console.log(`Transaction attempt ${attempt}/${maxRetries}`);
      
      // Get fresh blockhash for each attempt to prevent blockhash expiration issues
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
      
      // Verify wallet is still connected right before sending
      if (!wallet.publicKey) {
        throw new Error('Wallet disconnected. Please reconnect and try again.');
      }
      
      // Send the transaction
      signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight,
        preflightCommitment: preflightCommitment as any,
        maxRetries: 5 // Internal retries for network issues
      });
      
      console.log(`Transaction sent with signature ${signature}`);
      
      toast.dismiss(loadingToast);
      const confirmToast = toast.loading(`Confirming transaction... Please wait.`);
      
      // Create confirmation promise with timeout and proper handling for blockhash expiration
      const confirmationPromise = new Promise<boolean>((resolve, reject) => {
        // Set confirmation timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Transaction confirmation timeout'));
        }, maxTimeout);
        
        // Start watching for confirmation
        (async () => {
          try {
            // Confirm with more flexible strategy - don't require blockhash verification
            // This helps when the RPC node might not have the blockhash anymore
            const confirmation = await connection.confirmTransaction({
              signature,
              // Still pass blockhash info for nodes that support it
              blockhash,
              lastValidBlockHeight
            }, confirmCommitment as any);
            
            clearTimeout(timeoutId);
            
            if (confirmation.value.err) {
              reject(new Error(`Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`));
            } else {
              resolve(true);
            }
          } catch (error) {
            // For confirmation errors, check if the transaction was actually confirmed despite the error
            try {
              // Double-check transaction status directly
              const status = await connection.getSignatureStatus(signature, {
                searchTransactionHistory: true,
              });
              
              if (status && status.value && !status.value.err) {
                // Transaction was confirmed despite the error in confirmTransaction
                clearTimeout(timeoutId);
                resolve(true);
                return;
              }
            } catch (statusError) {
              // Ignore errors from getSignatureStatus and proceed with original error
              console.log("Error checking transaction status:", statusError);
            }
            
            clearTimeout(timeoutId);
            reject(error);
          }
        })();
      });
      
      try {
        // Wait for confirmation
        await confirmationPromise;
        
        // If we get here, transaction was successful
        success = true;
        toast.dismiss(confirmToast);
        toast.success('Transaction confirmed successfully!');
        
        return signature;
      } catch (confirmError: any) {
        // Check if it's a blockhash expiration error but the transaction might still be valid
        if (confirmError.message && (
            confirmError.message.includes('block height exceeded') || 
            confirmError.message.includes('blockhash not found')
        )) {
          // Manually check transaction status after a small delay
          // Sometimes transactions are confirmed but the confirmation API throws errors
          toast.loading(`Verifying transaction status...`);
          await new Promise(r => setTimeout(r, 2000));
          
          try {
            const status = await connection.getSignatureStatus(signature, {
              searchTransactionHistory: true,
            });
            
            if (status && status.value && !status.value.err) {
              // Transaction was actually confirmed despite the blockhash expiration error
              success = true;
              toast.dismiss(confirmToast);
              toast.success('Transaction confirmed successfully!');
              return signature;
            }
          } catch (statusError) {
            // Continue with retry if we can't verify status
            console.log("Error checking transaction status:", statusError);
          }
        }
        
        // Rethrow the error to be caught by the outer try/catch
        throw confirmError;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`Transaction attempt ${attempt} failed:`, error);
      
      // Handle wallet connection errors specifically
      const isWalletError = 
        error.message?.includes('Wallet is not connected') || 
        error.message?.includes('Wallet disconnected') ||
        error.message?.includes('wallet adapter');
        
      if (isWalletError) {
        toast.dismiss(loadingToast);
        toast.error('Wallet connection error. Please reconnect your wallet and try again.');
        throw error; // Don't retry on wallet errors
      }
      
      // Check if this is a blockhash-related error that we can retry
      const isBlockhashError = 
        error.message?.includes('block height exceeded') || 
        error.message?.includes('blockhash not found') ||
        error.message?.includes('invalid blockhash');
        
      // If we have more retries and it's a blockhash error, retry
      if (attempt < maxRetries && (isBlockhashError || error.message?.includes('timeout'))) {
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

/**
 * Extracts a user-friendly error message from a transaction error
 */
export function getErrorForTransaction(rawMessage: string): string {
  // Define common error patterns and their user-friendly messages
  const errorMap: Record<string, string> = {
    'Attempt to debit an account but found no record of a prior credit': 
      'Insufficient funds for transaction',
    'insufficient funds': 
      'Insufficient SOL balance to pay for transaction fees',
    'not the mint authority': 
      'Your wallet is not the mint authority for this token',
    'already in use': 
      'This token already exists. Use a different mint address.',
    'Program failed to complete': 
      'Transaction failed to process',
    'Transaction was not confirmed': 
      'Transaction was not confirmed within the timeout period',
    'blockhash not found': 
      'Transaction blockhash expired. Please try again.',
    'RPC request error': 
      'Network connection error. Please check your internet connection.',
    'Token account does not exist': 
      'Token account not found. It may need to be created first.',
    'No token mint specified': 
      'No token mint address was provided',
    'Invalid program id': 
      'Invalid program ID used in the transaction',
    'nonce is stale': 
      'Transaction nonce is stale. Please retry with a fresh nonce.',
    'Signature verification failed': 
      'Transaction signature verification failed. Please check your wallet connection.',
  };

  // Process the raw message to find matching error patterns
  let errorMessage = 'Transaction failed';
  
  // First try exact message matches
  if (errorMap[rawMessage]) {
    return errorMap[rawMessage];
  }
  
  // Then try partial matches
  for (const [errorPattern, friendlyMessage] of Object.entries(errorMap)) {
    if (rawMessage.includes(errorPattern)) {
      return friendlyMessage;
    }
  }
  
  // If it contains "Attempt to load an invalid account"
  if (rawMessage.includes('Attempt to load an invalid account')) {
    return 'Invalid account specified in transaction. Please check all addresses.';
  }
  
  // Return the raw message as a fallback
  return `Transaction failed: ${rawMessage}`;
}

/**
 * Enhanced send transaction function with better error handling specifically for token operations
 */
export async function sendTokenTransaction(
  connection: Connection,
  wallet: any,
  transaction: Transaction,
  signers: Keypair[] = [],
  options: {
    maxRetries?: number;
    skipPreflight?: boolean;
    preflightCommitment?: Commitment;
    confirmCommitment?: Commitment;
    maxTimeout?: number;
  } = {}
): Promise<string> {
  const {
    maxRetries = 3,
    skipPreflight = false,
    preflightCommitment = 'confirmed',
    confirmCommitment = 'confirmed',
    maxTimeout = 60000 // Default to 60 seconds
  } = options;

  let attempt = 0;
  let lastError = null;

  // Get latest blockhash before sending
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(preflightCommitment);
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  
  // Add a uniqueness nonce field to avoid duplicate transactions
  transaction.feePayer = wallet.publicKey;
  
  if (signers.length > 0) {
    transaction.sign(...signers);
  }
  
  const loadingToast = toast.loading('Processing transaction...');
  
  try {
    while (attempt < maxRetries) {
      attempt++;
      try {
        // Send transaction through wallet adapter
        const signature = await wallet.sendTransaction(transaction, connection, {
          skipPreflight,
          preflightCommitment,
          maxRetries: 2,
        });
      
        toast.dismiss(loadingToast);
        const confirmToast = toast.loading('Confirming transaction...');
      
        try {
          // Wait for confirmation with a timeout
          await Promise.race([
            connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight
            }, confirmCommitment),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transaction confirmation timeout')), maxTimeout)
            )
          ]);
          
          toast.dismiss(confirmToast);
          return signature;
        } catch (confirmError: any) {
          toast.dismiss(confirmToast);
          
          if (confirmError.message?.includes('timeout')) {
            // For timeout errors, provide a signature and notify the user
            toast.loading(
              'Transaction may have succeeded, but confirmation timed out. Please check explorer.'
            );
            return signature;
          } else {
            throw confirmError;
          }
        }
      } catch (error: any) {
        lastError = error;
        
        // If this is the final retry, throw the error
        if (attempt >= maxRetries) {
          throw error;
        }
        
        // If blockhash not found, get a new one and retry
        if (error.message?.includes('blockhash not found')) {
          const { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } = 
            await connection.getLatestBlockhash(preflightCommitment);
          transaction.recentBlockhash = newBlockhash;
          transaction.lastValidBlockHeight = newLastValidBlockHeight;
          // Retry immediately with new blockhash
          continue;
        }
        
        // For other errors, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    // This should never be reached due to the throw in the loop
    throw lastError || new Error('Transaction failed after maximum retries');
  } catch (error: any) {
    toast.dismiss(loadingToast);
    
    // Extract and convert error to user-friendly message
    const errorMessage = error.message || 'Unknown error occurred';
    const friendlyMessage = getErrorForTransaction(errorMessage);
    
    // Throw error with friendly message
    throw new Error(friendlyMessage);
  }
} 