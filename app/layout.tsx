import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import WalletContextProvider from "@/components/wallet/wallet-provider"
import { ThemeProvider } from "@/components/theme-provider"
import Script from 'next/script'
import { CustomToaster } from "@/components/ui/toast"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Token Manager | Solana",
  description: "Create, mint, and manage SPL tokens on Solana",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://unpkg.com/react@18/umd/react.development.js"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <WalletContextProvider>
            <CustomToaster />
            {children}
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}