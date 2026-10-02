# Architecture & Technical Design — PantaChat

## 1. System Architecture Overview

PantaChat is built as a modular monorepo consisting of:
1. **Core Service (Node.js/TypeScript):** Houses business logic, Panta API typed client, database ORM, AI prompt orchestrator, and background pollers.
2. **Bot Adapters:**
   - **Telegram Bot:** Built with `Telegraf`, supporting inline keyboards, in-place odds updates (`ctx.editMessageText`), and Telegram Mini App webviews with external browser fallback.
   - **Discord Bot:** Built with `discord.js v14`, supporting Slash Commands, Message Context Menu commands, and Ephemeral messages.
3. **Signing Web App & Portfolio (Next.js 15 App Router + Tailwind CSS):**
   - Lightweight frontend hosting the Solana Wallet Adapter with `/sign` and `/positions`.
   - Compiles versioned transactions from Panta API instructions.
   - Runs either as a standalone web page or embedded inside a Telegram Mini App modal (with external browser fallback).
4. **Data Layer (PostgreSQL via Prisma or Supabase):**
   - Persistent store for users, linked wallets, cached markets, sessions, orders, and local trade ledger.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PANTACHAT ARCHITECTURE                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌───────────────────┐                                 ┌───────────────────┐
│   Telegram Bot    │                                 │    Discord Bot    │
│  (grammY library) │                                 │   (discord.js)    │
└─────────┬─────────┘                                 └─────────┬─────────┘
          │                                                     │
          └─────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
                     ┌─────────────────────────────┐
                     │       Shared Core API       │
                     │  • Claude AI Drafter        │
                     │  • Panta Typed SDK Client   │
                     │  • Order State Machine      │
                     │  • Quota-Conscious Caching  │
                     └──────────────┬──────────────┘
                                    │
             ┌──────────────────────┴──────────────────────┐
             ▼                                             ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│       Data Layer        │                   │     Signing WebApp      │
│  PostgreSQL / Supabase  │                   │  (Next.js + Solana WA)  │
│  • Users & Linked Walts │                   │  • VersionedTx Compiler │
│  • Orders & Ledger      │                   │  • TMA Native Webview   │
│  • Market Catalog Cache │                   │  • 5-State Stepper      │
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
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── env.ts                  # Validated Zod environment config
│   │   └── constants.ts            # Panta constants, categories, fee presets
│   ├── core/
│   │   ├── pantaClient.ts          # Typed Panta API client with error envelopes
│   │   ├── aiDrafter.ts            # Claude Sonnet 5.5 (claude-sonnet-5-5) market drafter
│   │   ├── formatters.ts           # USDC base unit vs decimal normalizer
│   │   ├── stateMachine.ts         # 5-state order progression & verify poller
│   │   └── quotaManager.ts         # Rate limit aware cache (reads, builds)
│   ├── bots/
│   │   ├── telegram/
│   │   │   ├── bot.ts              # grammY bot initialization & commands
│   │   │   ├── replyHandler.ts     # /market reply handler
│   │   │   └── cards.ts            # Dynamic inline keyboard market cards
│   │   └── discord/
│   │       ├── bot.ts              # discord.js client initialization
│   │       ├── contextMenu.ts      # "Make a market" message action
│   │       └── embeds.ts           # Rich Embed card generator
│   ├── jobs/
│   │   ├── resolutionWatcher.ts    # Checks for resolved markets & win nudges
│   │   └── reconciliation.ts       # Retries stuck 'built' create sessions
│   └── web/                        # Next.js App Router (Signing WebApp & TMA)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx            # Web Companion Portal / Explorer
│       │   ├── sign/
│       │   │   └── page.tsx        # Wallet connection & transaction signer
│       │   └── api/
│       │       └── session/route.ts# Session verification & quote bridge
│       ├── components/
│       │   ├── WalletProvider.tsx  # @solana/wallet-adapter-react setup
│       │   ├── OrderStepper.tsx    # Visual 5-state progress indicator
│       │   └── OddsBar.tsx         # Visual sentiment progress bar
│       └── lib/
│           ├── solana.ts           # instructionsToVersionedTx compiler
│           └── storage.ts          # Client-side session store
└── docs/
    ├── prd.md
    ├── architecture.md
    ├── project-plan.md
    ├── design-system.md
    ├── memory.md
    ├── handoff.md
    └── agent-prompts.md
```

---

## 3. Database Schema (Prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String      @id @default(uuid())
  telegramId   String?     @unique
  discordId    String?     @unique
  wallet       String?     // Base58 Solana public key
  createdAt    DateTime    @default(now())
  markets      Market[]    @relation("CreatedMarkets")
  orders       Order[]
}

model Market {
  id              String      @id // Panta eventPda / marketId
  createId        String?     @unique
  creatorId       String
  creator         User        @relation("CreatedMarkets", fields: [creatorId], references: [id])
  chatPlatform    String      // "telegram" | "discord"
  chatId          String      // Group ID where spawned
  messageId       String?     // Live card message ID for in-place edits
  question        String
  category        String
  startTime       Int
  endTime         Int
  resolutionTime  Int
  phase           String      @default("primary") // primary | secondary | resolved | cancelled
  resolved        Boolean     @default(false)
  outcome         String?     // "yes" | "no" | null
  yesPrice        Float?
  noPrice         Float?
  createdAt       DateTime    @default(now())
  orders          Order[]
}

model Order {
  id              String      @id @default(uuid())
  orderId         String?     @unique // Panta orderId
  quoteId         String?
  marketId        String
  market          Market      @relation(fields: [marketId], references: [id])
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  side            String      // "yes" | "no"
  amountUsdc      Decimal
  sharesExpected  Decimal?
  status          String      // built | submitted | confirmed | failed | expired
  signature       String?     @unique
  createdAt       DateTime    @default(now())
}
```

---

## 4. Key Technical Workflows

### 4.1 Solana Instruction to VersionedTransaction Compilation
Panta's `POST /primaryorderbuild/` returns an array of instructions (`programId`, base64 `data`, `accounts`). The webapp compiles these into a `VersionedTransaction`:
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

### 4.2 Handling Panta API Errors
The client enforces fail-closed error envelope handling:
* `QUOTE_STALE`: Automatically re-quotes once with fresh slippage before showing user error.
* `AMOUNT_TOO_SMALL`: Displays minimum fill requirement banner.
* `MARKET_NOT_IN_PRIMARY`: Intercepts and switches UI to secondary market mode.
* `MARKET_NOT_GRADUATED`: Explains that creator royalties unlock upon graduation.

### 4.3 Demo Mode & Sandbox Architecture
* **Global Sandbox Default:** The entire architecture is configured to run out-of-the-box in Demo Mode on Solana Devnet and Panta Staging (`https://staging-api.panta.market/api/v1`).
* **Devnet Faucet Pipeline:** 
  * Direct RPC connection calls `connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL)` to provision transaction gas.
  * In-chat `/faucet <wallet>` command and in-app 1-tap faucet button allow evaluators to self-fund instantly.
* **Sandbox Data Seeding:** Syncs automatically with Panta's 50 pre-existing staging markets, allowing immediate trading and resolution testing.
