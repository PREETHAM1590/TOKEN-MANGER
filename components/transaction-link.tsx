"use client";

import { ExternalLink } from "lucide-react";

interface TransactionLinkProps {
  signature: string;
  cluster?: "mainnet" | "devnet" | "testnet" | "custom";
  customExplorerUrl?: string;
  shortSignature?: boolean;
}

export function TransactionLink({
  signature,
  cluster = "devnet",
  customExplorerUrl,
  shortSignature = true
}: TransactionLinkProps) {
  if (!signature) return null;

  const baseUrl = customExplorerUrl || 
    (cluster === "mainnet" 
      ? "https://explorer.solana.com/tx" 
      : `https://explorer.solana.com/tx?cluster=${cluster}`);

  const explorerUrl = `${baseUrl}/${signature}`;
  
  const displaySignature = shortSignature 
    ? `${signature.slice(0, 8)}...${signature.slice(-8)}`
    : signature;

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 break-all"
    >
      {displaySignature}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
} 