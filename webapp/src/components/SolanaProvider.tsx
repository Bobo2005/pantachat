"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// Solana Devnet RPC endpoint
export const SOLANA_DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  // Modern Solana wallets (Phantom, Solflare, Backpack) support Wallet Standard natively
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={SOLANA_DEVNET_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default SolanaProvider;
