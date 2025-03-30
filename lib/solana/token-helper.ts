import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { Connection, PublicKey, TransactionInstruction, Transaction } from '@solana/web3.js';
import { toast } from 'react-hot-toast';
import { sendAndConfirmTransaction } from './transaction-helper';

/**
 * Ensures that a token account exists for the owner and mint.
 * If it doesn't exist, it will be created.
 * Returns the associated token account address.
 */
export async function getOrCreateAssociatedTokenAccount(
  connection: Connection,
  payer: { publicKey: PublicKey; secretKey: Uint8Array },
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if the token account exists
    try {
      const tokenAccount = await connection.getAccountInfo(associatedTokenAddress);

      // If the account exists, return the address
      if (tokenAccount) {
        console.log('Token account already exists:', associatedTokenAddress.toString());
        return associatedTokenAddress;
      }
    } catch (error) {
      console.log('Error checking token account, will attempt to create it:', error);
    }

    // The account doesn't exist, create it
    console.log('Creating token account for:', owner.toString());

    const transaction = new Transaction();
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedTokenAddress,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // Toast for account creation
    toast.loading('Creating token account...');

    // Send the transaction
    await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer],
      {
        commitment: 'confirmed',
        skipPreflight: false,
        maxRetries: 3
      }
    );

    toast.success('Token account created successfully!');
    return associatedTokenAddress;
  } catch (error: any) {
    console.error('Error creating token account:', error);
    if (!error.message.includes('already in use')) {
      toast.error('Failed to create token account: ' + error.message);
      throw error;
    }
    // If the error was because the account exists, that's fine - return the address
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return associatedTokenAddress;
  }
}

/**
 * Checks if a token account exists for the owner and mint.
 */
export async function doesTokenAccountExist(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<boolean> {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const tokenAccount = await connection.getAccountInfo(associatedTokenAddress);
    return tokenAccount !== null;
  } catch (error) {
    console.error('Error checking token account existence:', error);
    return false;
  }
} 