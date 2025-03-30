/**
 * Utility functions for wallet management
 */

/**
 * Resets the wallet connection state in local storage
 * Use this if a user is experiencing persistent connection issues
 */
export function resetWalletConnection(): boolean {
  try {
    // Clear wallet adapter state
    window.localStorage.removeItem('walletAdapter');
    
    // Clear our custom tracking keys
    window.localStorage.removeItem('lastConnectedWallet');
    window.localStorage.removeItem('walletAutoConnect');
    
    console.log('Wallet connection state has been reset');
    return true;
  } catch (error) {
    console.error('Error resetting wallet connection:', error);
    return false;
  }
}

/**
 * Checks if a wallet is available in the browser
 */
export function isWalletAvailable(walletName: string): boolean {
  const walletNameLower = walletName.toLowerCase();
  
  // Check for Phantom
  if (walletNameLower === 'phantom') {
    return typeof window !== 'undefined' && 'phantom' in window;
  }
  
  // Check for Solflare
  if (walletNameLower === 'solflare') {
    return typeof window !== 'undefined' && 'solflare' in window;
  }
  
  // Default to checking window for the wallet
  return typeof window !== 'undefined' && walletNameLower in window;
}

/**
 * Force wallet disconnect and reset state
 */
export function forceDisconnectWallet(): boolean {
  try {
    // Clear adapter state
    resetWalletConnection();
    
    // Force page reload to disconnect any active connections
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    
    return true;
  } catch (error) {
    console.error('Error forcing wallet disconnect:', error);
    return false;
  }
} 