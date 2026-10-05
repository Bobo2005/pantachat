# Architecture & Technical Design — PantaChat

## 1. System Architecture Overview

PantaChat is built as a modular monorepo consisting of:
1. **Core Service (Node.js/TypeScript):** Houses business logic, Panta API typed client, database ORM, AI prompt orchestrator, and background pollers.
2. **Bot Adapters:**
   - **Telegram Bot:** Built with `Telegraf`, supporting inline keyboards, in-place odds updates (`ctx.editMessageText`), and Telegram Mini App webviews with external browser fallback.
   - **Discord Bot:** Built with `discord.js v14`, supporting Slash Commands, Message Context Menu commands, and Ephemeral messages.
3. **Signing Web App & Portfolio (Next.js 16 App Router + Tailwind CSS):**
   - Lightweight frontend hosting the Solana Wallet Adapter with `/sign`, `/positions`, `/earnings`, and `/`.
   - Compiles versioned transactions from Panta API instructions.
   - Runs either as a standalone web page or embedded inside a Telegram Mini App modal (with external browser fallback).
4. **Data Layer (Supabase + Local SQLite/Drizzle):**
   - Persistent cloud store for users, linked wallets, cached markets, sessions, orders, deduplication index, and faucet claims.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PANTACHAT ARCHITECTURE                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌───────────────────┐                                 ┌───────────────────┐
│   Telegram Bot    │                                 │    Discord Bot    │
│    (Telegraf)     │                                 │   (discord.js)    │
└─────────┬─────────┘                                 └─────────┬─────────┘
          │                                                     │
          └─────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │       Shared Core API       │
                     │  • Claude AI Drafter        │
                     │  • Panta Typed SDK Client   │
                     │  • Market Deduplication     │
                     │  • Demo Faucet Dispenser    │
                     │  • Order State Machine      │
                     └──────────────┬──────────────┘
                                    │
             ┌──────────────────────┴──────────────────────┐
             ▼                                             ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│    Cloud Data Layer     │                   │ Responsive Companion &  │
│       (Supabase)        │                   │    Telegram Mini App    │
│  • Market Deduplication │                   │  (Next.js 16 + Tailwind)│
│  • Soft Archiving (Past)│                   │  • Desktop Top Navbar   │
│  • Faucet Rate-Limits   │                   │  • Mobile Bottom Bar    │
│  • User Positions Store │                   │  • 5-State Sign Stepper │
└─────────────────────────┘                   └────────────┬────────────┘
                                                           │
                                    ┌──────────────────────┴──────────────────────┐
                                    ▼                                             ▼
                     ┌─────────────────────────────┐               ┌─────────────────────────────┐
                     │      Panta Backend API      │               │     Solana RPC Cluster      │
                     │  (Staging or Production)    │               │    (Devnet or Mainnet)      │
                     └─────────────────────────────┘               └─────────────────────────────┘
```

---

## 2. Directory & File Structure

```
pantachat/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                    # Entrypoint launching Bot & API servers
│   ├── config/                     # Environment configuration & constants
│   ├── bot/
│   │   ├── telegram.ts             # Telegraf bot commands & inline cards
│   │   └── discord.ts              # Discord slash commands & embeds
│   ├── api/
│   │   ├── server.ts               # Express API endpoints
│   │   ├── faucet.ts               # Demo funds dispenser (Devnet SOL transfer)
│   │   └── panta/                  # Typed Panta API client
│   ├── ai/
│   │   └── drafter.ts              # Claude Sonnet 5.5 market drafter
│   ├── db/
│   │   ├── supabase.ts             # Supabase cloud client
│   │   ├── queries.ts              # Market deduplication, soft archiving, faucet
│   │   └── schema.ts               # Local Drizzle schema
│   └── utils/
│       ├── solana.ts               # RPC helpers & versioned tx compiler
│       └── formatters.ts           # USDC decimal & base unit normalizers
├── webapp/                         # Next.js 16 App Router
│   ├── src/app/
│   │   ├── layout.tsx              # Viewport meta configuration & Providers
│   │   ├── page.tsx                # Market Explorer (Active & History Tabs)
│   │   ├── positions/page.tsx      # Open bets & claim winnings (Table & Cards)
│   │   ├── earnings/page.tsx       # Creator royalties dashboard
│   │   ├── sign/page.tsx           # 5-step non-custodial signing portal
│   │   └── api/                    # Next.js API routes (faucet, positions, etc.)
│   └── src/components/
│       ├── Navbar.tsx              # Desktop header & Mobile bottom navigation bar
│       ├── WalletButton.tsx        # Responsive wallet trigger
│       ├── TelegramProvider.tsx    # Telegram WebApp SDK context & fallback
│       ├── DemoFundsModal.tsx      # Frictionless Devnet SOL faucet modal
│       └── CreateMarketModal.tsx   # Market creation form with deduplication guard
└── docs/
    ├── README.md
    ├── architecture.md
    ├── memory.md
    ├── handoff.md
    └── webapp/README.md
```

---

## 3. Database & Data Architecture (Supabase)

### 3.1 Market Deduplication
Before creating any market, `queries.ts` checks Supabase for existing questions:
```sql
SELECT id, question, phase FROM markets WHERE LOWER(TRIM(question)) = LOWER(TRIM(:question));
```
If a match is found, creation is aborted and the user is redirected to the existing market.

### 3.2 Soft Archiving (Market History)
Markets progress through the following phases:
1. `primary`: Active on bonding curve. Displayed in Explorer.
2. `secondary`: Graduated to orderbook. Displayed in Explorer.
3. `resolved`: Market resolved. Automatically moved to the **Past / History** tab. Positions remain claimable.

### 3.3 Demo Faucet Tracking
```sql
CREATE TABLE IF NOT EXISTS faucet_claims (
  wallet TEXT PRIMARY KEY,
  last_claim_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tx_signature TEXT,
  amount_sol NUMERIC
);
```
Enforces a 24-hour cooldown per wallet address before another transfer is permitted.

---

## 4. Universal Responsive UI Architecture

### 4.1 Viewport Configuration
Configured in `webapp/src/app/layout.tsx`:
```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
```
Prevents elastic jumping, double-tap zoom in iOS Safari, and enables full-height layout inside Telegram WebApp frames.

### 4.2 Mobile Bottom App Bar
On screens `< 768px`, navigation shifts from the top header to a thumb-accessible bottom bar (`h-14`):
- **Explorer**: Browse active & history prediction markets.
- **Positions**: Manage bets & claim winnings.
- **✨ Create**: Floating action button to launch new markets.
- **Royalties**: Creator earnings tracker.
- **💧 Faucet**: 1-tap Devnet SOL request.

Page content containers include `pb-20 md:pb-12` to guarantee zero overlapping.

### 4.3 Mobile Card Views
On desktop, `/positions` renders a full table. On mobile screens, each position dynamically renders as an individual card with prominent outcome badges (🟢 YES / 🟣 NO) and full-width claim buttons.

---

## 5. Non-Custodial Signing & Order Execution

### 5.1 Instruction to VersionedTransaction Compilation
Panta's `POST /primaryorderbuild/` returns instructions (`programId`, base64 `data`, `accounts`). The webapp compiles these into a `VersionedTransaction`:
```ts
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

export function instructionsToVersionedTx(
  instructions: BuiltInstruction[],
  feePayer: PublicKey,
  recentBlockhash: string
): VersionedTransaction {
  const ixs = instructions.map(ix => new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map(a => ({
      pubkey: new PublicKey(a.pubkey),
      isSigner: a.isSigner,
      isWritable: a.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  }));

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash,
    instructions: ixs,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
```

### 5.2 5-State Signer Stepper
Deep-linked signing via `/sign?session=<id>` guides users through:
1. `Quote`: Slippage calculation and price check.
2. `Build`: Fetching on-chain instructions from Panta API.
3. `Sign`: Non-custodial signature with Phantom, Solflare, or Backpack.
4. `Broadcast`: Solana RPC cluster confirmation.
5. `Confirmed`: Updating Supabase order records and reporting trade via `POST /trades/`.
