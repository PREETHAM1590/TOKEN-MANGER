import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "react-hot-toast"
import WalletContextProvider from "@/components/wallet/wallet-provider"
import { ThemeProvider } from "@/components/theme-provider"
import Script from 'next/script'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Solana Token Manager",
  description: "Create, mint, and manage Solana tokens",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
            {children}
            <Toaster position="bottom-right" />
          </WalletContextProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}