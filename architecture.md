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

---

## 6. Custom Bet Amount Architecture

PantaChat provides complete flexibility for wager sizes across all interfaces:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CUSTOM BET AMOUNT ARCHITECTURE                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  WebApp Explorer │       │  Sign Page Live  │       │ Bots (TG & Disc) │
│ Quick-Buy Modal  │       │ Amount Adjuster  │       │ Custom Commands  │
│  (Custom Input   │       │ (Pre-Approval    │       │ (/bet <id> <side>│
│   + $5-$100)     │       │  Recalculation)  │       │  <amount>)       │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │   Dynamic Quote Generator   │
                     │  • Spot Bonding Curve Math  │
                     │  • Estimated Shares         │
                     │  • Potential Profit & ROI   │
                     └──────────────┬──────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │  Non-Custodial Transaction  │
                     │  • Panta Instruction Build  │
                     │  • Phantom / Solflare Sign  │
                     └─────────────────────────────┘
```

1. **WebApp Quick-Buy Modal (`webapp/src/app/page.tsx`):**
   - Direct numeric input with numeric sanitization (`amount <= 0` disabled).
   - Quick pills (`$5`, `$10`, `$20`, `$50`, `$100`) for rapid 1-tap population.
   - Dynamic real-time calculation:
     $$\text{Estimated Shares} = \frac{\text{amount}}{\text{spotPrice}}$$
     $$\text{Est. Return} = \text{Estimated Shares} \times \$1.00$$
2. **Signing Portal Live Adjuster (`webapp/src/app/sign/page.tsx`):**
   - User can modify the bet amount directly on the review screen before wallet signature.
   - Triggers dynamic re-quote and re-build from the backend session, updating the VersionedTransaction and SPL Memo instructions on the fly.
3. **Telegram Bot Custom Betting (`commands.ts` & `callbacks.ts`):**
   - Slash Command: `/bet <marketId> <yes|no> <amount>` (e.g. `/bet mkt_solana yes 75`).
   - Reply-to-Bet: Replying `/bet yes 50` or `/buy no 100` directly to any in-chat market card.
   - Interactive Inline Button: `[ ⚙️ Custom Amount ]` button prompts custom input presets and Mini App deep links.
4. **Discord Bot Custom Betting (`commands.ts` & `interactions.ts`):**
   - Slash Command: `/bet market_id:<id> outcome:<yes|no> amount:<number>`.
   - Generates an instant signing session card with personalized estimated shares and deep-linked approval portal.

---

## 7. Discord Bot Architecture & Command Registration

### 7.1 Instant vs. Global Slash Command Sync
Discord slash commands require registration via the Discord REST API (`Routes.applicationCommands` or `Routes.applicationGuildCommands`).

- **Guild-Specific Registration (Development):**
  If `DISCORD_GUILD_ID` is defined in `.env`, commands are registered directly to that server, making them available **instantaneously** with zero CDN cache delay:
  ```ts
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  ```
- **Global Registration (Production):**
  If `DISCORD_GUILD_ID` is omitted, commands register globally across all Discord servers. Propagation takes approximately 5–15 minutes.
- **Dedicated Script:** Run `npm run register:discord` via [`scripts/register_discord_commands.ts`](file:///scripts/register_discord_commands.ts). In addition, `src/index.ts` automatically runs registration upon client startup.

### 7.2 AI Drafter vs. Market ID Query Routing
To prevent natural language questions from misrouting to Panta's staging dummy fixture (`"Fixture market for pktest keys..."`), `src/bot/discord/commands.ts` enforces strict route segmentation:
- **Market ID Lookup:** Only triggered if `!cleanQuery.includes(" ")` and matches known ID patterns (`mkt_...` or hex hash).
- **AI Drafter Route:** Any query containing spaces or natural language sentences routes directly to Claude Sonnet 5.5 (`draftMarketFromText`), preventing accidental fixture responses.

---

## 8. Brand Asset Pipeline & Metadata

PantaChat provides standardized brand visual assets in `assets/` and `webapp/public/`:
- **`panta-logo-white.png`**: High-resolution 1024x1024 white-background avatar optimized for Discord Bot Profile pictures and light theme cards.
- **`panta-logo-white.jpg`**, **`panta-logo-white.webp`**, **`panta-logo-white.gif`**, and **`panta-logo-white.svg`**: Multi-format exports under 10MB meeting Discord, Telegram, and OpenGraph requirements.
- **`panta-logo-black.svg`**: Dark-mode vector for headers and high-contrast night modes.

---

## 9. Tamper-Proof Automated AI Oracle & Resolution Engine

PantaChat replaces centralized market creator resolution and manual admin keys with an objective, decentralized verification pipeline.

```
┌────────────────────────────────────────────────────────────────────────┐
│               PANTACHAT AI ORACLE & RESOLUTION PIPELINE                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    1. Cutoff Timestamp Passes      │ (Date.now() >= cutoffAt)
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │   Trading Lockout: resolution_status = 'closed'       │
       │   • Quick-Buy disabled on WebApp                       │
       │   • Submit API rejects with 400 MARKET_CLOSED          │
       │   • Telegram & Discord switch to "Trading Closed" card │
       └────────────────────────────┬───────────────────────────┘
                                    │
    2. Background Poller (60s)      │ (src/services/resolution-poller.ts)
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │   Evidence-First AI Engine (src/services/ai-oracle.ts) │
       │   • Extracts official resolution source from rules     │
       │   • Fetches live factual data / scores / closing price │
       │   • Strict temperature 0.0 deterministic evaluation    │
       │   • Threshold: >= 95% confidence + finished event      │
       └────────────────────────────┬───────────────────────────┘
                                    │
                                    ├─── Confidence < 95% or Event Ongoing
                                    │    └── Remains in 'closed' (awaiting official confirmation)
                                    │
                                    └─── Confidence >= 95%
                                         ▼
       ┌────────────────────────────────────────────────────────┐
       │   Status Transitions to: 'proposed'                    │
       │   • Sets proposed_outcome = 'yes' | 'no' | 'void'      │
       │   • Starts 2-hour dispute window: dispute_until = +2h  │
       │   • Saves evidence_url, evidence_summary, confidence   │
       │   • Broadcasts Proposed Resolution Card to Chat        │
       └────────────────────────────┬───────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           │                                                 │
    Trader Disputes Outcome                           2 Hours Pass
    (/dispute <id> <reason>)                          With 0 Disputes
           │                                                 │
           ▼                                                 ▼
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ Status: 'disputed'                   │     │ Status: 'resolved'                   │
│ • Auto-finalization halted           │     │ • Sets phase = 'resolved'            │
│ • Flags for consensus review         │     │ • Evaluates winners @ $1.00/share    │
│ • Increments dispute_count           │     │ • VOID events refund 100% principal  │
│ • Logged in /oracle inspection       │     │ • Dispatches Winner / Refund Alerts  │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
```

### 9.1 Evidence-First Verification Engine (`src/services/ai-oracle.ts`)
- **Deterministic Consensus (Temp 0.0):** No creative temperature; outputs are strictly verifiable factual statements.
- **Authoritative Source Retrieval:** Resolution rules specify official sources (e.g. `premierleague.com`, `coingecko.com`, SEC filings).
- **Zero-Guessing Guard:** If confidence is below 95% or the event is incomplete, the engine returns `unresolved`, keeping the market in awaiting confirmation without forcing a result.

### 9.2 2-Hour Challenge Window & Community Dispute Mechanism
- Proposed outcomes are broadcast to community chats with direct links to the official evidence URL.
- Any participant can challenge a proposed outcome using `/dispute <market_id> <reason>` in Telegram or Discord.
- Raising a dispute transitions the market to `resolution_status = 'disputed'`, freezing automated finalization until consensus review.

### 9.3 Payout Economics & 100% VOID Refund Safety Net
- **Winning Positions:** Payout is calculated at strictly **$1.00 USDC per share**. Net profit = $\text{shares} \times \$1.00 - \text{costUsdc}$.
- **Canceled / Postponed Events (VOID):** If an event is called off or fails resolution criteria, `resolution_status = 'void'`. Both YES and NO depositors receive **100% of their deposited USDC** back with zero protocol fee deduction.
- **Non-Custodial Claim Settlement:** Claim transactions route through the `/sign` portal to sign a Solana claim transaction, with `isClaimSession` checks bypassing trade cutoff locks.

---

## 10. Multi-Surface Parity & Cross-Client Settlement Architecture

PantaChat enforces architectural and visual parity across all client surfaces: **Desktop WebApp**, **Mobile Web / Telegram Mini App (TMA)**, **Telegram Bot**, and **Discord Bot**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                 CROSS-CLIENT UNIFIED SETTLEMENT MATRIX                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│       Desktop WebApp    │   │      TMA / Mobile Web   │   │  Telegram & Discord Bots│
│       (/positions)      │   │       (/positions)      │   │       (/positions)      │
├─────────────────────────┤   ├─────────────────────────┤   ├─────────────────────────┤
│ • Full Data Table       │   │ • Card-Based Feed       │   │ • In-Chat Formatted Card│
│ • "Settled Result" col  │   │ • Settled Result Pill   │   │ • Rich Embed Fields     │
│   (🟢 YES, 🟣 NO, ⚪VOID)│   │   (🟢 YES, 🟣 NO, ⚪VOID)│   │   (🟢 YES, 🟣 NO, ⚪VOID)│
│ • Live PnL & Shares     │   │ • Payout Status Row     │   │ • Payout Status Label   │
│ • 1-Tap Claim Button    │   │ • 1-Tap Claim Button    │   │ • 1-Tap Claim Button    │
└───────────┬─────────────┘   └───────────┬─────────────┘   └───────────┬─────────────┘
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Non-Custodial Claim Stepper (/sign) │
                      │    • Ephemeral Session: sess_claim_... │
                      │    • Solana Memo: PantaChat:Claim:<id> │
                      │    • Smart Contract Vault (PDA)        │
                      │      ──[Burns Shares / Pays USDC]──>   │
                      │      Winner's Wallet (Phantom/Solflare)│
                      │    • Post-Claim Synchronization:       │
                      │      - isClaimed = true in localStorage│
                      │      - claimUserPositionsAsync() sync  │
                      │      - Dispatches Celebratory Notice   │
                      │      - NO RE-BETTING (No new positions)│
                      └────────────────────────────────────────┘
```

### 10.1 Universal Settled Badges & Payout States
All platforms compute position settlement deterministically:
1. **🟢 YES WON:** Market resolved YES. Winning YES shares pay out at $1.00 USDC each.
2. **🟣 NO WON:** Market resolved NO. Winning NO shares pay out at $1.00 USDC each.
3. **⚪ VOID (Canceled):** Event canceled or invalidated. Depositors receive a 100% principal USDC refund.
4. **⏳ In Progress / ⏳ Trading Closed:** Market actively open or trading locked awaiting cutoff AI verification.

### 10.2 Ephemeral Claim Sessions (`createClaimSession`) & Non-Rebetting Execution
- When a user views their portfolio in Telegram or Discord (`/positions`), the bot asynchronously evaluates whether any holding has claimable winnings or refunds.
- If claimable, the bot calls `createClaimSession()` (`src/api/panta/positions.ts`) to store an ephemeral session (`sess_claim_...`) with a 10-minute TTL.
- **Telegram Bot:** Renders an inline button using the Telegram WebApp SDK (`web_app: { url: signUrl }`) opening the TMA sheet without leaving the chat, with an external browser fallback.
- **Discord Bot:** Renders an interactive `ButtonBuilder` linking directly to `/sign?session=...`.
- **Claim Execution Invariant (No Re-Betting):**
  - Session types for claims are strictly typed as `"claim"` or `"claim_creator"` across all APIs (`/api/sessions/[id]`, `/api/sessions/[id]/submit`, and `/api/positions/claim`).
  - Upon on-chain confirmation, the client updates existing records in `localStorage` (`panta_positions_${wallet}`) setting `isClaimed = true`, `claimTxSignature = finalSig`, and `claimedAt = Date.now()`.
  - Claim transactions **never** generate a new `newPosEntry` or append open bets to the user's portfolio.
  - The server handler runs `claimUserPositionsAsync(marketId, wallet, finalSig)` to mark trades claimed across memory, Supabase (`trades.is_claimed = true`), and cloud storage.
- **Strict Expired Market Trading Lock:**
  - Markets past their `cutoffAt` timestamp or with `phase === 'resolved'` strictly reject BUY orders across all entry points with 400 `MARKET_CLOSED` / `MARKET_RESOLVED`.
  - The signing UI (`/sign`) performs client-side expiration checks to prevent wallet prompts for closed trades.
  - Claims remain completely unlocked on settled markets, allowing winners and voided depositors to retrieve funds at any time.

### 10.3 Hybrid Cloud Synchronization
- Database lookups in `src/db/queries.ts` (`getMarketById`) automatically query Supabase REST endpoints if a market ID is not found in the local SQLite cache.
- User handles are matched with or without leading `@` symbols, guaranteeing that positions created via WebApp, TMA, or bots are visible everywhere simultaneously.
- Aggregate claim calculations on `/positions` combine multiple positions for the same resolved market into a single on-chain transaction.


