# Solana Token Manager

A Next.js application for creating, minting, and managing Solana tokens on Devnet.

## Features

- Connect to Solana wallets (Phantom, Solflare, etc.)
- Create new SPL tokens
- Mint tokens to your wallet
- Send tokens to other addresses
- View transaction history

## Tech Stack

- **Frontend**: Next.js 15.1, React 19, TailwindCSS
- **Blockchain**: Solana Web3.js, SPL Token
- **UI Components**: Shadcn UI
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Solana wallet (e.g., Phantom)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/solana-token-manager.git
   cd solana-token-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   # or
   pnpm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Usage

1. Connect your wallet using the "Connect Wallet" button
2. Navigate to the appropriate section:
   - Create Token: Create a new SPL token
   - Mint Tokens: Mint additional tokens to your wallet
   - Send Tokens: Transfer tokens to another address

## Development

The project uses Next.js App Router. Key directories:

- `/app`: Page components and layouts
- `/components`: UI components
- `/lib`: Utility functions for Solana integration

## License

MIT 