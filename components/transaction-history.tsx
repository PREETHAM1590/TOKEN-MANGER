"use client"

import { useTransactionStore } from "@/lib/stores/transaction-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export default function TransactionHistory() {
  const { transactions } = useTransactionStore()

  if (transactions.length === 0) {
    return null
  }

  // Function to get badge variant based on transaction type
  const getTypeVariant = (type: string) => {
    switch (type) {
      case "create":
        return "outline"
      case "mint":
        return "secondary"
      case "send":
        return "default"
      default:
        return "outline"
    }
  }

  // Function to get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "success":
        return "success"
      case "pending":
        return "outline"
      case "error":
      case "failed":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent token transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant={getTypeVariant(tx.type)}>
                        {tx.type === "create" ? "Create" : tx.type === "mint" ? "Mint" : "Send"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{tx.tokenName || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{tx.tokenSymbol || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{tx.amount ? tx.amount.toString() : "N/A"}</TableCell>
                    <TableCell>{new Date(tx.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(tx.status)}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://explorer.solana.com/tx/${tx.id}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>View</span>
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

