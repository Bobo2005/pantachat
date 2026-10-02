"use client";

import React from "react";
import SolanaProvider from "./SolanaProvider";
import TelegramProvider from "./TelegramProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider>
      <TelegramProvider>{children}</TelegramProvider>
    </SolanaProvider>
  );
}

export default Providers;
