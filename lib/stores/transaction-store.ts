"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type TransactionType = "create" | "mint" | "send"
export type TransactionStatus = "success" | "error" | "pending"

export interface Transaction {
  id: string
  type: TransactionType
  tokenName: string | null
  tokenSymbol: string | null
  amount: number | null
  mintAddress: string
  recipient: string | null
  timestamp: number
  status: TransactionStatus
}

interface TransactionStore {
  transactions: Transaction[]
  addTransaction: (transaction: Transaction) => void
  clearTransactions: () => void
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set) => ({
      transactions: [],
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [transaction, ...state.transactions].slice(0, 50), // Keep only the last 50 transactions
        })),
      clearTransactions: () => set({ transactions: [] }),
    }),
    {
      name: "solana-token-manager-transactions",
    },
  ),
)

