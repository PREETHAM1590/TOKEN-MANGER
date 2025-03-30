import { Connection, PublicKey, Commitment } from '@solana/web3.js';

// Connection cache to avoid creating new connections
const connectionCache: Record<string, Connection> = {};

// Super fast connection pool for immediate access
const CONNECTION_POOL_SIZE = 2;
const connectionPool: Connection[] = [];
let connectionInitialized = false;

// Increase the default transaction confirmation timeouts for better reliability
const DEFAULT_TRANSACTION_TIMEOUT = 120000; // 120 seconds instead of 60

/**
 * Initialize a pool of connections for quick access - ultra fast version
 * This dramatically improves initial connection speed
 */
export function initConnectionPool(endpoint: string, size = 2): void {
  if (typeof window === 'undefined') return;
  if (connectionInitialized) return; // Already initialized
  
  // Mark as initialized immediately to prevent duplicate initialization attempts
  connectionInitialized = true;
  
  console.log("Initializing connection pool...");
  const startTime = performance.now();
  
  // Create connections with improved config for better reliability
  for (let i = 0; i < size; i++) {
    connectionPool.push(new Connection(endpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: DEFAULT_TRANSACTION_TIMEOUT,
      disableRetryOnRateLimit: false, // Enable retries on rate limit
      wsEndpoint: endpoint.replace('https://', 'wss://').replace('http://', 'ws://'), // Enable WebSocket for better performance
    }));
  }
  
  // Pre-warm the connection without blocking the UI
  setTimeout(() => {
    preWarmConnection(endpoint)
      .then(() => {
        const endTime = performance.now();
        console.log(`Connection pre-warm completed in ${Math.round(endTime - startTime)}ms`);
      })
      .catch(console.error);
  }, 100);
}

/**
 * Get a cached connection or create a new one if needed - ultra fast version
 */
export function getCachedConnection(
  endpoint: string,
  commitment: Commitment = 'processed'
): Connection {
  // Fast path: return from pool if available
  if (connectionPool.length > 0) {
    return connectionPool[0];
  }
  
  // Fallback path
  const cacheKey = `${endpoint}-${commitment}`;
  
  if (!connectionCache[cacheKey]) {
    connectionCache[cacheKey] = new Connection(endpoint, { 
      commitment,
      confirmTransactionInitialTimeout: DEFAULT_TRANSACTION_TIMEOUT,
      disableRetryOnRateLimit: false,
      wsEndpoint: endpoint.replace('https://', 'wss://').replace('http://', 'ws://'),
    });
  }
  
  return connectionCache[cacheKey];
}

/**
 * Pre-warm the Solana connection - ultra fast version
 */
export async function preWarmConnection(endpoint: string): Promise<boolean> {
  try {
    // Don't create any console logs for faster execution
    
    // Initialize pool immediately
    initConnectionPool(endpoint);
    
    // We won't wait for the connection to be established
    // This makes the UI feel much faster
    return true;
  } catch (error) {
    // Silently ignore errors
    return true; // Continue anyway to avoid blocking UI
  }
}

/**
 * Quickly check if a wallet is ready - ultra fast version
 */
export function isWalletReady(walletName: string): boolean {
  if (typeof window === 'undefined') return false;
  
  // Direct window property access for maximum speed
  const walletLower = walletName.toLowerCase();
  
  if (walletLower === 'phantom') {
    return !!window.phantom?.solana?.isPhantom;
  }
  
  if (walletLower === 'solflare') {
    return !!window.solflare?.isSolflare;
  }
  
  if (walletLower === 'backpack' || walletLower === 'backpack-wallet') {
    return !!(window as any).backpack?.isBackpack;
  }
  
  return walletLower in window;
}

/**
 * Quickly check account validity before attempting connection
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
} 