# PantaChat: Step-by-Step Project Implementation Plan
**Hackathon Target:** 1st Place ($2,000 USDG) Colosseum Crypto World's Fair (Panta API Sidetrack)  
**Long-Term Vision:** Production-ready conversational prediction layer for Telegram & Discord  
**Mode:** Staging / Devnet (`https://staging-api.panta.market/api/v1`) $\to$ 1-Line Toggle to Mainnet

---

## 1. Project Directory Structure

```tree
pantachat/
├── package.json
├── tsconfig.json
├── .env.example
├── .env
├── prd.md
├── architecture.md
├── project-plan.md
├── design-system.md
├── memory.md
├── handoff.md
├── agent-prompts.md
├── src/
│   ├── index.ts                     # Main entry point (starts Telegram, Discord, Express API)
│   ├── config.ts                    # Zod-validated environment config (Devnet/Mainnet toggle)
│   ├── bot/
│   │   ├── telegram/
│   │   │   ├── client.ts            # Telegraf instance initialization
│   │   │   ├── commands.ts          # /start, /market, /positions, /earnings, /leaderboard, /faucet
│   │   │   ├── callbacks.ts         # Inline button handlers (Refresh, Buy Presets, Custom, Faucet)
│   │   │   └── cards.ts             # In-chat interactive card with unicode odds bar
│   │   ├── discord/
│   │   │   ├── client.ts            # Discord.js client initialization
│   │   │   ├── commands.ts          # Slash commands & Context Menu ("Make a market")
│   │   │   ├── interactions.ts      # Discord button and modal submit handlers
│   │   │   └── embeds.ts            # Colored rich embeds with odds bars & action rows
│   │   └── common/
│   │       ├── card-builder.ts      # Shared odds calculation & progress bar generator
│   │       └── state.ts             # In-memory ephemeral session tracker (e.g. pending creations)
│   ├── api/
│   │   ├── panta/
│   │   │   ├── client.ts            # Axios wrapper with API key & rate limiter (Bottleneck)
│   │   │   ├── markets.ts           # Discovery, details, categories (120 req/min)
│   │   │   ├── create.ts            # Quote, build, register (20 req/min)
│   │   │   ├── trading.ts           # Primary quote & build with userId SPL Memo injection
│   │   │   ├── positions.ts         # Wallet positions & winner detection (60 req/min)
│   │   │   ├── claims.ts            # Win claims & creator royalties build (20 req/min)
│   │   │   └── trades.ts            # Trade attribution reporting (POST /trades/)
│   │   ├── server.ts                # Express backend serving signing sessions & webhooks
│   │   └── routes/
│   │       ├── sessions.ts          # POST /api/sessions/create, GET /api/sessions/:id
│   │       ├── orders.ts            # POST /api/orders/quote, /api/orders/build, /verify
│   │       ├── markets.ts           # Proxy routes for cached market discovery
│   │       └── health.ts            # Health check & RPC connectivity check
│   ├── ai/
│   │   ├── drafter.ts               # Anthropic Claude Sonnet 5.5 (claude-sonnet-5-5) market extraction
│   │   ├── prompts.ts               # Few-shot prompts with rules, sources & Ambiguity Guard
│   │   └── validator.ts             # Market title length, date validation (>30m into future)
│   ├── db/
│   │   ├── index.ts                 # Drizzle ORM / SQLite or PostgreSQL client
│   │   ├── schema.ts                # Markets, Trades, Users, Groups, Earnings tables
│   │   └── queries.ts               # Ledger operations & leaderboard aggregations
│   ├── services/
│   │   ├── resolution-poller.ts     # Periodic poller (1 min) for resolved markets & win nudges
│   │   ├── graduation-poller.ts     # Checks bonding curve progress & notifies creator royalties
│   │   └── attribution-reporter.ts  # Confirms tx on Solana RPC and reports to POST /trades/
│   └── utils/
│       ├── formatters.ts            # USDC decimal string vs base units (6 decimals)
│       ├── odds.ts                  # Payout multiplier and implied probability math
│       └── solana.ts                # Connection, devnet airdrop helper, tx confirmation
└── webapp/                          # Telegram Mini App & Web Signing Sheet
    ├── package.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx           # Solana Wallet Provider & Telegram WebApp SDK Script
    │   │   ├── page.tsx             # Universal Market Explorer & Leaderboard
    │   │   ├── sign/
    │   │   │   └── page.tsx         # In-App 5-State Signing Modal (TMA Bottom Sheet)
    │   │   ├── positions/
    │   │   │   └── page.tsx         # User Portfolio & 1-Tap Claim Center
    │   │   └── earnings/
    │   │       └── page.tsx         # Creator Royalties Hub (fee claim)
    │   ├── components/
    │   │   ├── WalletButton.tsx     # Phantom/Solflare Devnet connect button
    │   │   ├── Stepper.tsx          # 5-Stage visual progress stepper (Quote->Build->Approve->Confirm)
    │   │   ├── OrderSummary.tsx     # Sleek breakdown of shares, USDC cost, slippage, fees
    │   │   └── OddsBar.tsx          # Animated gradient bar for YES/NO sentiment
    │   └── lib/
    │       ├── solana.ts            # VersionedTransaction deserializer & wallet signer
    │       └── api.ts               # API client communicating with backend server
```

---

## 2. Step-by-Step Build Guide: From Frontend to Backend to AI

### Phase 1: Environment & Foundation Setup
1. **Initialize Project:**
   - Configure TypeScript (`tsconfig.json`) with strict mode and ESM.
   - Configure SQLite + Drizzle ORM for zero-friction local persistence and quick cloud deployment.
   - Setup `.env` with staging credentials (`https://staging-api.panta.market/api/v1`), Devnet RPC, Telegram Bot Token, Discord Token, and AI Key.
2. **Panta API Client with Strict Rate Limiting:**
   - Implement rate limiters via `bottleneck` or token bucket:
     - Read endpoints: 120 req/min
     - Position endpoints: 60 req/min
     - Build endpoints: 20 req/min (strictly protected)
   - Implement USDC formatting utilities:
     - `toBaseUnits("20.00")` $\to$ `20000000`
     - `fromBaseUnits(20000000)` $\to$ `"20.00"`

### Phase 2: AI Market Drafter ("Reply-to-Create")
1. **AI Prompt Engineering:**
   - Feed conversation context (replied message + last 3 chat messages).
   - Require structured JSON output:
     - `title`: Short, definitive prediction statement (e.g. "Arsenal qualifies for UCL semifinals?")
     - `description`: Detailed rules, resolution sources (e.g. "UEFA official match report"), cutoff timestamp (ISO 8601), and category.
     - `ambiguityGuard`: Boolean flag detecting ambiguous or subjective bets.
2. **Creation Quote & Build Pipeline:**
   - Call `POST /markets/create/quote/` with ISO timestamp and categories.
   - Call `POST /markets/create/build/` to get the base64-encoded `transaction` (`VersionedTransaction`).
   - Store creation session in DB and send interactive preview card to chat.

### Phase 3: Non-Custodial Signing WebApp (Telegram Mini App & Browser)
1. **Next.js + Solana Wallet Adapter:**
   - Configure `@solana/wallet-adapter-react` set to `clusterApiUrl("devnet")`.
   - Embed Telegram WebApp SDK (`@twa-dev/sdk`) so the signing page behaves natively as a bottom-sheet modal inside Telegram.
2. **5-State Visual Signing Stepper:**
   - State 1: **Quote** (Fetches real-time price & fees).
   - State 2: **Build** (Receives unsigned VersionedTransaction from Panta).
   - State 3: **Approve** (Prompts Phantom / Solflare wallet popup).
   - State 4: **Confirm** (Sends tx via Devnet RPC, awaits `confirmed` commitment).
   - State 5: **Register / Report** (Calls `POST /markets/register/` for creates or `POST /trades/` for buys).
   - Closes Mini App and posts confirmation back to Telegram / Discord.

### Phase 4: In-Chat Interactive Market Card (Telegram & Discord)
1. **Telegram In-Chat Card:**
   - Rich text layout with custom Unicode Sentiment Bar (`[🟩🟩🟩🟩🟩🟥🟥]`).
   - Inline Keyboard:
     - Row 1: `[ YES $5 ]` `[ YES $20 ]` `[ NO $5 ]` `[ NO $20 ]`
     - Row 2: `[ ⚙️ Custom ]` `[ 🔄 Refresh Odds ]` `[ 📊 Details ]`
   - In-place updates via `editMessageReplyMarkup` to eliminate spam.
2. **Discord Parity:**
   - Message Context Menu: Right-click message $\to$ "Make a market".
   - Embed with dynamic colored border: Green for Live, Purple for Resolved.
   - Ephemeral replies for `/positions` and `/earnings` so personal balances remain private.

### Phase 5: Post-Trade Automation (The Full Lifecycle)
1. **Resolution Poller & Winner Claims:**
   - Background worker checks active markets every 60 seconds via `GET /markets/{id}/`.
   - When status becomes `resolved`:
     - Calls `GET /positions/?marketId={id}` (within 60/min quota).
     - Identifies winning users and pings them in chat: *"@user won 45.20 USDC! [Claim Winnings]"*.
     - Claim button opens Signing Mini App with `POST /claim/build/`.
2. **Creator Royalties (`/earnings`):**
   - Monitors bonding curve progress until market graduates (`phase: secondary`).
   - Alerts creator: *"Your market has graduated! Creator fees are unlocked."*
   - Creator types `/earnings` to trigger `POST /claim/creator-fees/build/` and view dynamically returned `claimableFeesUsdc`.
3. **Attribution & Leaderboard:**
   - Explicitly calls `POST /trades/` with tx signature and `userId` after on-chain confirmation.
   - Leaderboard tracks top traders and top market creators across all groups.

---

## 3. Hackathon 10-Day Milestones

| Day | Milestone | Verification Criterion |
|---|---|---|
| **Day 1** | Project setup & Panta Staging API Client | Passes API health check, fetches test markets, auth works. |
| **Day 2** | Next.js Signing WebApp & Devnet Wallet Adapter | Connects Phantom Devnet, signs dummy tx, deserializes VersionedTx. |
| **Day 3** | AI Drafter & Market Creation Pipeline | `/market` generates clean JSON, `/markets/create/build` returns tx. |
| **Day 4** | Telegram Bot & Interactive Market Card | Group card renders odds bar, buttons open Mini App with quote. |
| **Day 5** | Primary Buy Order & 5-State Poller | Completes $5 test buy on Devnet, reports to `POST /trades/`. |
| **Day 6** | Discord Bot Parity & Ephemeral Privacy | Right-click "Make a market" works, ephemeral `/positions` works. |
| **Day 7** | Post-Trade Lifecycle (Claims & Nudges) | Resolution alert pings winner, claim tx executes successfully. |
| **Day 8** | Creator Royalties (`/earnings`) & Leaderboard | Graduated market fee claim works; leaderboard displays stats. |
| **Day 9** | Polish, Error Handling & Community Beta Test | Seeded in 3 Telegram groups; staging & Devnet end-to-end testing. |
| **Day 10** | Video Recording, Docs & Dual Submission | 2-min demo video recorded, submitted to Colosseum & Superteam. |
