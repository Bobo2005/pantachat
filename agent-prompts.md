# PantaChat: 20 Sequential AI Agent Prompts
**Purpose:** Use these 20 sequential prompts with your AI coding agent (e.g. Cursor, Claude, Antigravity) to build the complete, production-grade PantaChat MVP codebase from scratch.

---

## How to Use These Prompts
1. Run each prompt in order (Prompt 1 $\to$ Prompt 20).
2. Each prompt is self-contained with exact file paths, interfaces, types, error-handling rules, and references to the design system and memory files.
3. Ensure the project root contains `prd.md`, `architecture.md`, `project-plan.md`, `design-system.md`, and `memory.md` before starting.

---

### PROMPT 1: Project Initialization, TypeScript & Zod Environment Config
```markdown
We are building PantaChat (a conversational prediction market bot for Telegram and Discord on Solana, powered by the Panta API).
Refer to `prd.md`, `architecture.md`, and `memory.md` for architectural context.

Task: Initialize the backend project structure, dependencies, and type-safe environment configuration.

1. Create `package.json` in the root with dependencies:
   - `telegraf` (^4.16.3), `discord.js` (^14.16.3), `@solana/web3.js` (^1.95.4), `@solana/spl-token` (^0.4.9)
   - `axios` (^1.7.9), `bottleneck` (^2.19.5), `zod` (^3.24.1), `dotenv` (^16.4.7), `express` (^4.21.2), `cors` (^2.8.5)
   - `drizzle-orm` (^0.38.3), `better-sqlite3` (^11.8.1)
   - `@anthropic-ai/sdk` (^0.33.1)
   - DevDependencies: `typescript` (^5.7.3), `@types/node`, `@types/express`, `@types/cors`, `@types/better-sqlite3`, `tsx` (^4.19.2), `drizzle-kit` (^0.30.2)
   - Scripts: "dev": "tsx watch src/index.ts", "build": "tsc", "start": "node dist/index.js", "db:push": "drizzle-kit push"

2. Create `tsconfig.json` with strict mode, ES2022 target, NodeNext module resolution.

3. Create `src/config.ts`:
   - Use Zod to validate process.env:
     - `PANTA_API_BASE_URL` (default: "https://staging-api.panta.market/api/v1")
     - `PANTA_API_KEY` (string, min 1)
     - `SOLANA_RPC_URL` (default: "https://api.devnet.solana.com")
     - `SOLANA_NETWORK` ("devnet" | "mainnet", default: "devnet")
     - `TELEGRAM_BOT_TOKEN` (string)
     - `TELEGRAM_BOT_USERNAME` (string)
     - `DISCORD_BOT_TOKEN` (string)
     - `DISCORD_CLIENT_ID` (string)
     - `ANTHROPIC_API_KEY` (string)
     - `PORT` (coerce number, default: 3001)
     - `WEBAPP_URL` (default: "http://localhost:3000")
     - `DATABASE_URL` (default: "file:./pantachat.db")
   - Export typed `config` object.

4. Create `.env.example` mirroring these variables with clear comments for staging vs live.
```

---

### PROMPT 2: Database Schema & Local Persistence with Drizzle ORM
```markdown
Refer to `architecture.md` (Section 3: Database & State Architecture).

Task: Implement the SQLite database schema and client using Drizzle ORM.

1. Create `src/db/schema.ts` defining:
   - `markets`:
     - `id` (text, primaryKey - Panta market ID or local UUID)
     - `title` (text, notNull)
     - `description` (text)
     - `category` (text)
     - `creatorWallet` (text)
     - `creatorPlatformId` (text - Telegram/Discord username or ID)
     - `platform` ("telegram" | "discord")
     - `chatId` (text - group or channel ID)
     - `messageId` (text - card message ID for in-place updates)
     - `phase` ("primary" | "secondary" | "resolved", default: "primary")
     - `cutoffAt` (integer timestamp)
     - `resolvedOutcome` (text - null | "yes" | "no")
     - `yesPrice` (real, default: 0.5)
     - `noPrice` (real, default: 0.5)
     - `volumeUsdc` (real, default: 0.0)
     - `createdAt` (integer timestamp)
   - `trades`:
     - `id` (text, primaryKey)
     - `marketId` (text, references markets.id)
     - `walletAddress` (text)
     - `platformUserId` (text)
     - `platform` ("telegram" | "discord")
     - `chatId` (text)
     - `outcome` ("yes" | "no")
     - `spendUsdc` (real)
     - `shares` (real)
     - `txSignature` (text, unique)
     - `reportedToPanta` (integer boolean, default: 0)
     - `createdAt` (integer timestamp)
   - `sessions`:
     - `id` (text, primaryKey - uuid)
     - `type` ("create" | "buy" | "claim" | "claim_creator")
     - `marketId` (text)
     - `platformUserId` (text)
     - `chatId` (text)
     - `platform` ("telegram" | "discord")
     - `payloadJson` (text)
     - `status` ("pending" | "signed" | "confirmed" | "failed" | "expired")
     - `createdAt` (integer timestamp)
     - `expiresAt` (integer timestamp)

2. Create `src/db/index.ts`:
   - Initialize BetterSqlite3 database at `config.DATABASE_URL`.
   - Export typed `db` instance and helper query functions in `src/db/queries.ts` (e.g. saveMarket, getMarketById, recordTrade, getRecentTradesForUser, getLeaderboard).
```

---

### PROMPT 3: USDC Unit Normalizer & Panta Rate-Limited API Client
```markdown
Refer to `memory.md` (Section 1: Quota Protection & USDC Unit Normalization).

Task: Build the core Panta API HTTP client with strict quota limiters and unit formatting helpers.

1. Create `src/utils/formatters.ts`:
   - `toBaseUnits(amount: string | number): number` (Converts human USDC like "20.00" or 20 to 6-decimal integer 20000000).
   - `fromBaseUnits(baseUnits: number | string): string` (Converts 20000000 to "20.00").
   - `formatUsdc(amount: number): string` (Formats number as "$20.00").
   - `formatPercentage(prob: number): string` (e.g. 0.68 -> "68%").

2. Create `src/api/panta/client.ts`:
   - Setup Axios instance with `baseURL: config.PANTA_API_BASE_URL` and headers:
     - `Authorization: Bearer ${config.PANTA_API_KEY}`
     - `Content-Type: application/json`
   - Implement Bottleneck rate limiters according to `memory.md`:
     - `readLimiter`: 120 req/min (reservoir: 120, reservoirRefreshInterval: 60 * 1000)
     - `positionLimiter`: 60 req/min (reservoir: 60, reservoirRefreshInterval: 60 * 1000)
     - `buildLimiter`: 20 req/min (reservoir: 20, reservoirRefreshInterval: 60 * 1000) - NEVER violate this!
   - Add Axios response interceptors for standardized error handling (catching `QUOTE_STALE`, `RATE_LIMIT_EXCEEDED`, `MARKET_NOT_GRADUATED`, `TX_NOT_FOUND`).
   - Export `pantaGet(url, config, limiterType)`, `pantaPost(url, data, config, limiterType)`.
```

---

### PROMPT 4: Panta Market Discovery & Details Service (with Caching)
```markdown
Refer to `architecture.md` (Section 2: API Surface Mapping) and `memory.md`.

Task: Implement the market discovery, detail lookup, and in-memory caching module.

1. Create `src/api/panta/markets.ts`:
   - Implement `getMarkets(params?: { category?: string; status?: string; limit?: number })`:
     - Calls `GET /markets/` using `readLimiter`.
     - In-memory cache with 60-second TTL to avoid eating the 120 req/min quota.
   - Implement `getMarketById(marketId: string)`:
     - Calls `GET /markets/{marketId}/` using `readLimiter`.
     - Returns live spot prices (`yesPrice`, `noPrice`), volume, liquidity, phase, and cutoff time.
   - Implement `getCategories()`:
     - Calls `GET /categories/` (cached 1 hour).
   - Add a helper `getMarketStats(marketId: string)` that calculates:
     - Implied probabilities: `yesProb = yesPrice / (yesPrice + noPrice)`
     - Estimated payout multipliers: `yesPayout = 1 / yesPrice`, `noPayout = 1 / noPrice`
     - Time remaining string: e.g. "4h 20m" or "28d 14h".
```

---

### PROMPT 5: AI Drafter Service ("Reply-to-Create" with Claude Sonnet 5.5)
```markdown
Refer to `pantachat_plan_v3.md` (Moat 1: Reply-to-Create) and `memory.md` (Ambiguity Guard).

Task: Build the AI Market Drafter service that converts raw Telegram/Discord chat messages into valid, structured Panta prediction markets.

1. Create `src/ai/prompts.ts`:
   - Define system prompt for Claude Sonnet 5.5 (`claude-sonnet-5-5`):
     - Goal: Act as an expert prediction market creator for Solana's Panta protocol.
     - Enforce rules:
       - Question must be crisp, binary (YES/NO), and unambiguous.
       - Description must specify the exact, objective resolution source (e.g. "Official UEFA match sheet", "CoinGecko at 00:00 UTC", "AP News call").
       - Cutoff date must be at least 30 minutes in the future (default to the event end date/time in ISO 8601).
       - Select exact category: "Crypto" | "Sports" | "Tech" | "Politics" | "Culture" | "Finance".
       - Enforce Ambiguity Guard: if the input banter is subjective, opinion-based, or non-verifiable, set `isAmbiguous: true` with a polite clarification reason.
     - Provide 3 few-shot examples (Sports debate, Crypto price prediction, Tech release date).

2. Create `src/ai/drafter.ts`:
   - Implement `draftMarketFromText(banterText: string, contextMessages: string[]): Promise<DraftedMarket>`:
     - Calls Anthropic API (Claude Sonnet 5.5 `claude-sonnet-5-5` via `config.ANTHROPIC_MODEL`) with JSON response schema.
     - Validates output using Zod (`title` max 100 chars, `description` max 500 chars, `cutoffAt` ISO string, `category`, `isAmbiguous`, `clarificationPrompt`).
   - If `isAmbiguous` is true, return a friendly guidance message to prompt the user for clearer terms.
```

---

### PROMPT 6: Market Creation Pipeline (Quote, Build & Register)
```markdown
Refer to `architecture.md` (Market Creation Flow) and `memory.md` (Build Quota).

Task: Build the Panta Market Creation pipeline handling Quote derivation, Transaction assembly, and on-chain Registration.

1. Create `src/api/panta/create.ts`:
   - Implement `getCreateQuote(params: { title: string; category: string; cutoffAt: string })`:
     - Calls `POST /markets/create/quote/`.
     - Returns creation fee (base units) and event PDA address.
   - Implement `getCreateBuild(params: { title: string; description: string; category: string; cutoffAt: string; creatorWallet: string })`:
     - Calls `POST /markets/create/build/` using `buildLimiter` (20 req/min quota).
     - Returns unsigned base64-encoded `VersionedTransaction`.
   - Implement `registerMarket(params: { signature: string; eventPda: string })`:
     - Calls `POST /markets/register/`.
     - Finalizes the market on Panta indexer and returns the live `marketId`.

2. Create helper `initiateMarketCreationSession(...)`:
   - Saves a pending session in SQLite `sessions` table with an expiration TTL (10 minutes).
   - Generates a deep link to the Signing WebApp / TMA: `${config.WEBAPP_URL}/sign?session=${sessionId}`.
```

---

### PROMPT 7: Primary Buy Order Pipeline & Trade Attribution
```markdown
Refer to `architecture.md` (Primary Buy Order Flow) and `memory.md` (Trade Attribution).

Task: Implement the primary buy order quote and build pipeline, ensuring proper partner attribution and slippage handling.

1. Create `src/api/panta/trading.ts`:
   - Implement `getPrimaryOrderQuote(params: { marketId: string; outcome: "yes" | "no"; spendUsdc: string })`:
     - Calls `POST /primaryorderquote/` with `spendUsdc` as human decimal string (e.g. "20.00").
     - Returns `estimatedShares`, `feeUsdc`, `effectivePrice`, and `quoteId` (TTL ~90s).
   - Implement `getPrimaryOrderBuild(params: { marketId: string; outcome: "yes" | "no"; spendUsdc: string; maxSlippageBps?: number; buyerWallet: string; platformUserId: string })`:
     - Uses `buildLimiter` (20 req/min quota).
     - Passes `userId: usr_<uuid>` derived from `platformUserId`. (Note: Attribution is finalized via explicit POST /trades/ reporting).
     - Default `maxSlippageBps: 300` (3.0% slippage protection).
     - Returns unsigned base64 `transaction`.

2. Create helper `createTradeSession(...)`:
   - Records pending session in DB for either preset amounts ($5, $20) or custom amounts.
   - Returns signing URL for Telegram Mini App or Discord link.
```

---

### PROMPT 8: Order Verification, 5-State Poller & POST /trades/ Reporting
```markdown
Refer to `architecture.md` (State 4 & 5) and `memory.md` (Order Lifecycle Progression).

Task: Build the transaction verification poller and trade attribution reporting service.

1. Create `src/utils/solana.ts`:
   - Initialize `@solana/web3.js` Connection with `config.SOLANA_RPC_URL` (devnet).
   - Implement `waitForConfirmation(signature: string, maxTimeoutMs = 30000)`:
     - Polls signature status until `commitment: "confirmed"`.
     - Returns boolean success or throws descriptive error (`TRANSACTION_TIMED_OUT`, `SLIPPAGE_FAIL`).

2. Create `src/services/attribution-reporter.ts`:
   - Implement `reportTradeToPanta(params: { signature: string; userId: string; marketId: string })`:
     - Awaits Solana RPC confirmation FIRST (critical: avoids `TX_NOT_FOUND`).
     - Calls `POST /trades/` with `{ signature, userId, marketId }`.
     - Verifies attribution by querying `GET /trades/{signature}/`.
     - Updates `trades` table in local database (`reportedToPanta = 1`).
     - Triggers in-place card update in the originating Telegram chat / Discord channel.
```

---

### PROMPT 9: Post-Trade Lifecycle: Winner Detection & Claim Nudges
```markdown
Refer to `pantachat_plan_v3.md` (Moat 2: Full Lifecycle) and `memory.md` (Quota Protection).

Task: Implement the resolution watcher and automated winner claim nudge alert poller.

1. Create `src/api/panta/positions.ts`:
   - Implement `getWalletPositions(walletAddress: string)`:
     - Calls `GET /positions/?wallet=${walletAddress}` using `positionLimiter` (60 req/min).
     - Identifies positions with `status: "won"` and `isClaimed: false`.
   - Implement `getClaimBuild(params: { marketId: string; walletAddress: string })`:
     - Calls `POST /claim/build/` using `buildLimiter` (20 req/min).
     - ONLY called when the user physically clicks "Claim Winnings" (never background polled!).

2. Create `src/services/resolution-poller.ts`:
   - Runs every 60 seconds.
   - Queries local active markets with status `primary` or `secondary`.
   - Checks `GET /markets/{id}/` for status transition to `resolved`.
   - When resolved:
     - Updates local DB `phase: "resolved"`.
     - Finds all trades associated with this market in the DB.
     - For each winner, sends a celebratory message in the group:
       *"🎉 Market Resolved! @user won estimated $XX.XX USDC! Tap below to claim your payout."*
     - Attaches inline button: `[ 💰 Claim Winnings ]` deep-linked to TMA claim session.
```

---

### PROMPT 10: Creator Royalties Service (`/earnings` & Graduation Watcher)
```markdown
Refer to `architecture.md` (Creator Fee Claim Flow) and `memory.md` (Graduation Invariant).

Task: Implement Creator Royalties tracking, bonding curve graduation notifications, and the `/earnings` command.

1. Create `src/api/panta/claims.ts`:
   - Implement `getCreatorFeeClaimBuild(params: { marketId: string; creatorWallet: string })`:
     - Verifies market is in `phase: "secondary"` first (CRITICAL: prevents `MARKET_NOT_GRADUATED` 400 error).
     - Calls `POST /claim/creator-fees/build/` using `buildLimiter`.
     - Returns base64 `transaction`.
     - Note: DO NOT report this claim to `POST /trades/`!

2. Create `src/services/graduation-poller.ts`:
   - Periodically checks markets created by PantaChat users.
   - When a market graduates from bonding curve (`primary` $\to$ `secondary`):
     - Pings creator in chat: *"🚀 Your market '[Title]' just GRADUATED to secondary trading! Creator fee royalties are now unlocked. Type /earnings to claim."*

3. Implement `/earnings` handler logic:
   - Aggregates all markets created by the user from SQLite.
   - Calculates total volume, estimated royalties, and claimable fees.
   - Displays a breakdown with a 1-tap `[ ⚡ Claim Creator Royalties ]` button.
```

---

### PROMPT 11: Shared Card Builder & Unicode Odds Bar Generator
```markdown
Refer to `design-system.md` (Section 3: In-Chat Visual Card Layout) and `architecture.md`.

Task: Create the cross-platform visual card formatter that produces slick, high-contrast prediction cards for Telegram and Discord.

1. Create `src/bot/common/card-builder.ts`:
   - Implement `generateProgressBar(yesPercent: number, totalBlocks = 10): string`:
     - Computes green blocks (`🟩`) vs red blocks (`🟥`).
     - Example (64% YES): `[🟩🟩🟩🟩🟩🟩🟥🟥🟥🟥]`
   - Implement `buildMarketCardText(market: MarketData)`:
     - Formats Header, Title, Sentiment Bar with live percentages.
     - Displays live multipliers: e.g. "YES: 1.56x (+56%) | NO: 2.78x (+178%) (Mark-to-Market)".
     - Displays metadata: Volume, Liquidity, Trader count, Time remaining.
     - Adds clear status badge: "🟢 Live Primary Curve" or "🟣 Graduated Secondary".
     - Adds footer: "⚡ Powered by Panta • Non-Custodial".
   - Export helper `getPresetBuyButtons(marketId: string)` returning button payloads for:
     - `[ 🟢 Buy YES $5 ]`, `[ 🟢 Buy YES $20 ]`, `[ 🔴 Buy NO $5 ]`, `[ 🔴 Buy NO $20 ]`
     - `[ ⚙️ Custom ]`, `[ 🔄 Refresh Odds ]`, `[ 📊 Details ]`
```

---

### PROMPT 12: Telegram Bot - Client Initialization & Core Commands
```markdown
Refer to `project-plan.md` and `architecture.md` (Section 4: Telegram Interface).

Task: Initialize the Telegram bot using Telegraf with full command routing.

1. Create `src/bot/telegram/client.ts`:
   - Initialize Telegraf instance with `config.TELEGRAM_BOT_TOKEN`.
   - Add error catch handler to log errors without crashing.

2. Create `src/bot/telegram/commands.ts`:
   - `/start`:
     - Welcomes user, explains how to add the bot to groups, and provides quick tour.
     - If launched with payload (e.g. `/start market_xyz`), immediately renders that market card.
   - `/market`:
     - Checks if message is a reply to another message (`ctx.message.reply_to_message.text`).
     - If not a reply, checks if prompt arguments were provided (`/market Will BTC hit 100k?`).
     - Triggers AI Drafter service to generate structured draft.
     - Posts interactive Preview Card with `[ ✅ Confirm & Create ]` and `[ ❌ Cancel ]` buttons.
   - `/bet <marketId> <yes|no> <amount>`:
     - Allows custom amount betting on any market with instant validation and dynamic odds calculation.
     - Reply-to-Bet: Users can reply `/bet yes 50` or `/buy no 100` directly to any in-chat market card.
   - `/positions`: Displays user's active bets and claimable payouts.
   - `/earnings`: Displays creator royalties and graduation status.
   - `/leaderboard`: Displays top community predictors by volume and PnL.
   - /faucet [wallet]: Airdrops 2 Devnet SOL and test USDC for instant risk-free sandbox testing.
```

---

### PROMPT 13: Telegram Bot - In-Chat Interactive Card & In-Place Callbacks
```markdown
Refer to `design-system.md` and `memory.md` (Telegram Nuances).

Task: Implement Telegram callback queries with in-place odds refreshing and Telegram Mini App signing buttons.

1. Create `src/bot/telegram/callbacks.ts`:
   - Handle `refresh_odds:<marketId>`:
     - Fetches latest spot prices via `getMarketById(marketId)`.
     - Calls `ctx.editMessageText()` or `ctx.editMessageReplyMarkup()` to update the card in-place with zero spam.
     - Answers callback query with: `ctx.answerCbQuery("Odds updated!")`.
   - Handle `buy_preset:<marketId>:<outcome>:<amount>`:
     - Creates pending buy session in DB.
     - Answers with Telegram Mini App web_app button:
       `web_app: { url: `${config.WEBAPP_URL}/sign?session=${sessionId}` }`
     - Opens the non-custodial signing sheet inside Telegram without leaving the chat!
   - Handle `custom_amount:<marketId>:<outcome>`:
     - Prompts user or opens Mini App slider modal.
   - Handle `create_confirm:<draftId>`:
     - Creates creation session and opens Mini App to sign `VersionedTransaction` on Devnet.
```

---

### PROMPT 14: Discord Bot - Client, Slash Commands & Message Context Menu
```markdown
Refer to `pantachat_plan_v3.md` (Platform Feasibility: Discord Nuances) and `architecture.md`.

Task: Initialize the Discord bot using discord.js v14 with slash commands and the Message Context Menu for Reply-to-Create.

1. Create `src/bot/discord/client.ts`:
   - Initialize Discord Client with intents: `GatewayIntentBits.Guilds`, `GatewayIntentBits.GuildMessages`.
   - (Note: Do NOT require privileged MessageContent intent).

2. Create `src/bot/discord/commands.ts`:
   - Register Application Commands via REST API (and `npm run register:discord` with `DISCORD_GUILD_ID`):
     - Slash Command `/market [query]`: AI Market Drafter with natural language banter vs. market ID routing guard.
     - Slash Command `/bet [market_id] [outcome] [amount]`: Custom amount betting with instant signing link.
     - Slash Command `/positions`: Ephemeral view of open predictions and claims.
     - Slash Command `/earnings`: Ephemeral creator royalties breakdown.
     - Slash Command `/leaderboard`: Community trading rankings.
     - Slash Command `/faucet [wallet]`: Zero-friction Devnet SOL dispenser.
     - **Message Context Menu Command (`ApplicationCommandType.Message`):** Labeled `"Make a prediction market"`.
       - When a user right-clicks any chat message $\to$ Apps $\to$ "Make a prediction market", it extracts the target message text and feeds it to the AI Drafter!
   - Handle command executions and ephemeral preview responses.
```

---

### PROMPT 15: Discord Bot - Rich Embeds, Colored Borders & Ephemeral Balances
```markdown
Refer to `design-system.md` (Surface 1: Discord Rich Embeds) and `memory.md`.

Task: Implement Discord Rich Embed cards with colored status borders, Action Rows, and ephemeral balance security.

1. Create `src/bot/discord/embeds.ts`:
   - Build Discord Embed:
     - Title with category icon (e.g. ⚽ Sports, ⚡ Crypto).
     - Color code: `#10B981` (Green - Primary Bonding Curve), `#9945FF` (Purple - Graduated Secondary), `#64748B` (Grey - Resolved).
     - Fields: Sentiment progress bar (monospace), Est. Payouts, Volume, Cutoff timestamp `<t:timestamp:R>`.
     - Footer: "⚡ Powered by Panta • Non-Custodial".
   - Build Action Rows:
     - Row 1: `ButtonBuilder` for `[ YES $5 ]`, `[ YES $20 ]`, `[ NO $5 ]`, `[ NO $20 ]` (Link buttons or custom IDs).
     - Row 2: `[ 🔄 Refresh ]`, `[ 📊 Details ]`.

2. Create `src/bot/discord/interactions.ts`:
   - Handle Button clicks:
     - For `/positions` and `/earnings`: reply with `flags: MessageFlags.Ephemeral` so personal balances remain private in a crowded server!
     - For Buy buttons: respond with signing link URL opening the WebApp modal.
     - For Refresh button: call `interaction.update()` to update the embed in-place.
```

---

### PROMPT 16: Express Backend Server & Signing Session API
```markdown
Refer to `architecture.md` (Section 3: API & Webhook Layer).

Task: Build the Express API server that serves session data to the Telegram Mini App and coordinates order submission.

1. Create `src/api/server.ts`:
   - Setup Express app with `cors({ origin: "*" })`, `express.json()`.
   - Mount routes:
     - `GET /api/sessions/:id`: Retrieves pending signing session (type, market details, quote, transaction base64).
     - `POST /api/sessions/:id/submit`:
       - Receives signed serialized transaction from the frontend.
       - Broadcasts to Solana Devnet RPC.
       - Awaits confirmation.
       - Triggers attribution reporting (`POST /trades/`) or market registration (`POST /markets/register/`).
       - Updates DB session status to "confirmed".
     - `GET /api/markets/trending`: Returns top 10 cached markets.
     - `GET /api/health`: Health check verifying RPC and Panta API connectivity.

2. Create `src/index.ts`:
   - Starts Express server on `config.PORT`.
   - Launches Telegram bot (`bot.launch()`).
   - Logs in Discord client (`client.login()`).
   - Starts `resolutionPoller` and `graduationPoller`.
   - Graceful shutdown handling (SIGINT, SIGTERM).
```

---

### PROMPT 17: Next.js WebApp - Tailwind Setup, Fonts & Glassmorphism System
```markdown
Refer to `design-system.md` (Theme, Color Palette, Glassmorphism).

Task: Initialize the Next.js frontend in `webapp/` with modern dark mode, Solana accents, and glassmorphism components.

1. Configure `webapp/tailwind.config.ts`:
   - Define custom colors:
     - `bg-primary`: "#0b0e14"
     - `bg-surface`: "#141a23"
     - `bg-glass`: "rgba(20, 26, 35, 0.75)"
     - `yes-green`: "#10b981"
     - `no-red`: "#ef4444"
     - `solana-purple`: "#9945ff"
     - `solana-cyan`: "#14f195"
   - Configure fonts: `Inter`, `Outfit`, `JetBrains Mono`.

2. Setup `webapp/src/app/globals.css`:
   - Include `.glass-panel` backdrop-filter styles.
   - Configure sleek scrollbars and glowing button hover transitions.

3. Create reusable UI components in `webapp/src/components/`:
   - `OddsBar.tsx`: Animated split bar displaying YES% vs NO% with percentage labels.
   - `Badge.tsx`: Status pills ("Devnet 🟢", "Primary Curve", "Graduated", "Resolved").
   - `Button.tsx`: Glowing gradient buttons with loading spinners.
```

---

### PROMPT 18: Next.js WebApp - Solana Wallet Adapter & Telegram WebApp SDK
```markdown
Refer to `architecture.md` (Section 5: Signing WebApp & Telegram Mini App).

Task: Configure Solana Wallet Adapter for Devnet and integrate the Telegram Mini App SDK.

1. Install dependencies in `webapp/`:
   - `@solana/wallet-adapter-base`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`
   - `@solana/web3.js`, `@twa-dev/sdk`

2. Create `webapp/src/components/SolanaProvider.tsx`:
   - Configure `ConnectionProvider` with Devnet RPC.
   - Configure `WalletProvider` with Phantom, Solflare, and Backpack wallets.
   - Wrap with `WalletModalProvider`.

3. Create `webapp/src/components/TelegramProvider.tsx`:
   - Initializes Telegram WebApp SDK (`window.Telegram.WebApp`).
   - Calls `WebApp.ready()` and `WebApp.expand()` so the Mini App opens as an expanded modal sheet.
   - Adapts color scheme to match Telegram theme if available.
   - Provides a 1-tap 'Open in External Browser' fallback if the in-app webview restricts wallet deep-linking.

4. Create `webapp/src/components/WalletButton.tsx`:
   - Custom styled Devnet wallet connect button matching the glassmorphism theme.
   - Displays connected address truncated (e.g. `7xK...9zP`) and devnet SOL balance.
```

---

### PROMPT 19: Next.js WebApp - 5-State Visual Signing Stepper (TMA Modal)
```markdown
Refer to `design-system.md` (Section 4) and `pantachat_plan_v3.md` (Surface 2: TMA Signing Sheet).

Task: Build the in-app 5-state signing page (`webapp/src/app/sign/page.tsx`) that handles non-custodial signing inside Telegram and browsers.

1. Implement `webapp/src/app/sign/page.tsx`:
   - Reads `sessionId` from URL query parameter.
   - Fetches session details from backend (`GET /api/sessions/:id`).
   - Renders 5-State Visual Stepper:
     - **Stage 1 (Quote):** Displays market question, outcome chosen, and real-time quote (shares, fees, payout).
     - **Stage 2 (Build):** Fetches base64 `VersionedTransaction` from session.
     - **Stage 3 (Approve):** Prompts user's connected wallet to sign using `signTransaction(versionedTx)`.
     - **Stage 4 (Confirm):** Submits signed transaction to backend/RPC and displays live animated confirmation spinner.
     - **Stage 5 (Success):** Confetti animation, Solana Explorer link, and auto-close button that signals Telegram WebApp `WebApp.close()`.
   - Handle Slippage / Stale Quote:
     - If price shifted, displays clear warning: *"Price updated. 1-tap re-quote"* with instant refresh.
```

---

### PROMPT 20: Next.js WebApp - Market Explorer, User Portfolio & Creator Hub
```markdown
Refer to `pantachat_plan_v3.md` (Surface 3: Web Companion Portal) and `prd.md`.

Task: Build the full web companion pages for global discovery, user portfolio tracking, and creator royalties.

1. Implement `webapp/src/app/page.tsx` (Market Explorer):
   - Grid of active prediction cards across all Telegram groups and Discord servers.
   - Category filter pills (All, Crypto, Sports, Tech, Politics).
   - Search bar filtering markets by title.
   - Clicking any card opens quick-buy modal.

2. Implement `webapp/src/app/positions/page.tsx` (Portfolio & Claims):
   - Connects user wallet and fetches positions via `GET /positions/?wallet=...`.
   - Table of active holdings: Market, Outcome (YES/NO), Shares, Purchase Cost, Current Value, PnL.
   - Highlight section: **Claimable Winnings** with glowing `[ Claim USDC ]` button.

3. Implement `webapp/src/app/earnings/page.tsx` (Creator Royalties Hub):
   - Displays all markets spawned by the user.
   - Shows accumulated creator fees.
   - Graduation status progress bar (`$X / $10,000 Volume to Graduation`).
   - 1-click `[ Claim Creator Royalty ]` button for graduated markets.
   - Header badge: "⚡ Powered by Panta • Built for Colosseum".
```
