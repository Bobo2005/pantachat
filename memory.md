# PantaChat: AI Agent Memory & Technical Invariants
**File Purpose:** Permanent technical memory for AI coding agents generating, maintaining, and debugging PantaChat.

---

## 1. Panta API Golden Rules & Strict Invariants

### 1. Quota & Rate Limit Protection
* **Build Quota:** Strictly **20 requests / minute**.
  * Affected endpoints: `POST /primaryorderbuild/`, `POST /markets/create/build/`, `POST /claim/build/`, `POST /claim/creator-fees/build/`.
  * **CRITICAL INVARIANT:** NEVER background poll or schedule cron jobs calling build endpoints!
  * Claim detection MUST be done using `GET /positions/?wallet=` (60 req/min). Only call `/claim/build/` when a user physically taps the "Claim" button.
* **Positions Quota:** **60 requests / minute**. Use for checking user balances and winner status.
* **Market Read Quota:** **120 requests / minute**. Cache `GET /markets/` and `GET /markets/{id}/` in memory for 60–120 seconds.

### 2. USDC Decimal vs. Base Units Normalization
Panta API uses TWO different number formats across different endpoints:
* **Human Decimal Strings (`"20.00"`):**
  * `POST /primaryorderquote/` $\to$ `spendUsdc: "20.00"`
  * `POST /primaryorderbuild/` $\to$ `spendUsdc: "20.00"`
* **Integer Base Units (`20000000`, 6 Decimals):**
  * `POST /primaryordersubmit/` and `/verify/`
  * `POST /markets/create/quote/` creation fees
  * `POST /claim/creator-fees/build/`
* **Invariant:** Always use the centralized `formatUsdc()` / `parseUsdc()` helper module to avoid unit conversion errors.

### 3. Order Lifecycle Progression (5 States)
Orders must strictly follow:
`built` $\to$ `submitted` $\to$ `confirmed` (or `failed` / `expired`).
* When signing via the webapp/TMA, immediately broadcast via Solana RPC.
* Wait for `confirmed` commitment on-chain BEFORE calling `POST /trades/`.
* If `POST /trades/` is called before on-chain confirmation, Panta returns `TX_NOT_FOUND`.

### 4. Trade Attribution (Explicit POST /trades/ Reporting)
* Explicitly report every confirmed trade via `POST /trades/` with `{ signature, userId, marketId }` (where `userId: usr_<uuid>` is a pseudonymous UUID for the Telegram/Discord user).
* Always wait for Solana RPC `confirmed` status before calling `POST /trades/` to prevent `TX_NOT_FOUND`.

### 5. Creator Fees & Graduation Rules
* Creator fees can ONLY be claimed after the market graduates (`phase: secondary`).
* The exact claimable fee amount is determined dynamically by the Panta protocol and returned by `POST /claim/creator-fees/build/` (`claimableFeesUsdc`). Do NOT hardcode or promise a fixed "20%" cut.
* If `POST /claim/creator-fees/build/` is called while the market is still in `phase: primary`, Panta returns `400 MARKET_NOT_GRADUATED`.
* Never report creator fee claims to `POST /trades/` (this throws `TX_MISMATCH`).

### 6. Ambiguity Guard & AI Market Drafting
* **AI Model:** Uses Claude Sonnet 5.5 (`claude-sonnet-5-5`), dynamically configurable via `ANTHROPIC_MODEL`.
* When AI drafts a market from raw chat banter:
  * Cutoff time (`cutoffAt`) must be at least **30 minutes in the future** (ISO 8601).
  * Category must be one of Panta's official categories: `Crypto`, `Politics`, `Sports`, `Culture`, `Tech`, `Finance`.
  * The question must have a binary (YES/NO) resolution with verifiable, objective criteria and specified sources.
  * If the input is subjective or untestable, return `isAmbiguous: true` with a polite clarification prompt.

---

## 2. Supabase Persistence & Lifecycle Invariants

### 1. Market Deduplication Invariant
* **Strict Check Before Create:** Before any market is created (from WebApp, Telegram Bot, or Discord Bot), the system must query Supabase to verify that an identical question does not already exist.
* If a market exists:
  * Return a helpful error with a link to trade on the existing market.
  * Prevent duplicate transaction building and avoid unnecessary gas / API calls.

### 2. Soft Archiving (Market History) Invariant
* **No Hard Deletion:** Resolved markets are NEVER deleted from the database.
* When a market resolves:
  1. Update `phase` to `resolved` and record `resolved_outcome` (`yes` or `no`).
  2. The Explorer feed filters out resolved markets from the active view by default.
  3. Resolved markets are displayed in the **Past / History** tab.
  4. The deduplication index retains the question forever to prevent identical duplicate markets from ever being re-created.
  5. Winning positions remain permanently claimable via `/positions`.

### 3. Frictionless Demo Faucet Invariant
* **No Third-Party OAuth Dependency:** Faucet dispenser operates via direct Devnet SOL transfer from the backend keypair (`FAUCET_PRIVATE_KEY`).
* **24-Hour Cooldown:** Enforce a strict 24-hour rate limit per Solana wallet address recorded in Supabase (`faucet_claims`).
* **Bot Notification Dispatch:** Whenever a claim completes successfully, dispatch an event or alert to Telegram and Discord channels with the Solscan transaction link.

---

## 3. Responsive UI & Telegram Mini App (TMA) Invariants

### 1. Safe Viewport Settings
* Mobile viewports must have `viewportFit: "cover"`, `userScalable: false`, and `maximumScale: 1` in `layout.tsx` to prevent accidental zooming and clipping in mobile browser webviews.

### 2. Mobile Bottom Navigation Spacing
* When mobile bottom navigation (`h-14`) is present on screens `< 768px`, page containers must include bottom padding `pb-20 md:pb-12` so content and footers are never obscured.

### 3. Modal Overflow Protection
* All modal overlays (`CreateMarketModal`, `DemoFundsModal`, `QuickBuyModal`) must have `max-h-[92vh]` and `overflow-y-auto` so buttons remain accessible on small smartphone screens and when mobile software keyboards are active.

---

## 4. Environment & Endpoints Configuration

* **Staging / Devnet URL (Default):** `https://staging-api.panta.market/api/v1`
  * Devnet Solana RPC: `https://api.devnet.solana.com`
* **Production / Mainnet URL (1-Line Toggle):** `https://live-api.panta.market/api/v1`
  * Set `PANTA_API_BASE_URL=https://live-api.panta.market/api/v1` in `.env`.
  * Set `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`.

---

## 5. Common Error Codes & Mitigations

| Error Code | Cause | Automated Mitigation |
|---|---|---|
| `DUPLICATE_MARKET` | Market question was already launched | Intercept and return link to existing market card |
| `FAUCET_COOLDOWN` | Wallet requested funds <24h ago | Display countdown time until next eligible faucet claim |
| `QUOTE_STALE` | Price shifted on bonding curve during user signing delay | Mini App automatically fetches fresh quote and updates stepper with 1-tap re-sign |
| `RATE_LIMIT_EXCEEDED` | Exceeded 20/min build or 120/min read | Request queued in Bottleneck rate limiter with exponential backoff (jitter) |
| `MARKET_NOT_GRADUATED` | Called creator fee claim before secondary phase | UI disables button and displays progress bar: `Liquidity: $X / $10,000 to Graduation` |
| `MARKET_CLOSED` | Attempted buy order after cutoff timestamp | UI disables Quick-Buy and submit API rejects with 400 MARKET_CLOSED |
| `TX_NOT_FOUND` | Reported trade to `/trades/` before RPC confirmed | Verify poller awaits Solana RPC commitment `confirmed` before calling `/trades/` |
| `INVALID_CUTOFF` | Market resolution date is in past or <30m | AI Drafter validates `cutoffAt > Date.now() + 30 * 60 * 1000` before calling create quote |

---

## 6. Discord & Staging API Routing Invariants

### 1. Market ID vs. Natural Language Routing
* **Staging Fallback Fixture:** The Panta Staging API returns `{ title: "Fixture market for pktest keys. Not on mainnet." }` with `id: undefined` when querying `GET /markets/{id}/` with unknown endpoints or non-existent IDs.
* **Invariant:** Never route arbitrary text or natural language prompts to `getMarketById()`.
* **Guard Pattern:**
  ```ts
  const isLikelyId = !cleanQuery.includes(" ") && (cleanQuery.startsWith("mkt_") || cleanQuery.startsWith("market_") || /^[a-zA-Z0-9_-]{20,}$/.test(cleanQuery));
  ```
  If `cleanQuery` contains spaces or does not match ID format, always route to Claude Sonnet 5.5 (`draftMarketFromText`).

### 2. Discord Slash Command Registration Latency
* **Global (`Routes.applicationCommands`):** Discord requires 5–15 minutes to distribute slash commands globally across all guilds.
* **Guild-Level (`Routes.applicationGuildCommands`):** Instantaneous propagation.
* **Invariant:** In test environments, configure `DISCORD_GUILD_ID` in `.env` to enable immediate command sync for rapid iteration.

### 3. Custom Amount Dynamic Instruction Invariant
* When a user changes the bet amount on `/sign`, the frontend must recalculate `estimatedShares` and re-derive the Panta instruction set / SPL Memo.
* The backend trade session must reflect the updated `spendUsdc` before the user signs, ensuring the Solana transaction parameters match what is submitted to `POST /trades/`.

---

## 7. AI Oracle Resolution & Settlement Invariants

### 1. Cutoff Lockout Invariant
* **Strict Trade Rejection:** The exact millisecond `Date.now() > cutoffAt`, all trading is locked.
* WebApp Quick-Buy is disabled with `⏳ Trading Closed`.
* Submit API rejects any buy order with `400 MARKET_CLOSED`.
* Bots switch card badges from `🟢 Live Primary Curve` to `⏳ Trading Closed (Awaiting Resolution)`.
* Past message callback button taps reject with `"❌ Trading has ended for this market."`.

### 2. Deterministic AI Verification Invariant
* AI Oracle runs with strict **temperature 0.0**.
* Resolution criteria extracts official authority URLs (e.g. Premier League, CoinGecko, official SEC filings).
* **Strict 95% Confidence Guard:** If confidence < 0.95 or the event has not finished, the engine returns `unresolved`. The market remains in `closed` status with ZERO guessing.

### 3. 2-Hour Dispute Window Invariant
* Proposed outcomes enter a mandatory 2-hour challenge period (`dispute_until = now + 7200`).
* Traders can trigger `/dispute <market_id> <reason>` in Telegram or Discord.
* A single dispute immediately transitions `resolution_status = 'disputed'`, halting automated settlement for manual consensus review.

### 4. Non-Custodial Payout & 100% VOID Refund Invariant
* **Winning Markets:** Payout is calculated at strictly **$1.00 USDC per winning share**.
* **VOID Canceled Markets:** Returns **100% of deposited USDC** to both YES and NO holders with zero fee deduction.
* **Signing Session Bypass:** `/sign` explicitly allows claim/refund sessions (`isClaimSession`) to execute past market cutoff without being blocked by trade closure guards.
* **Non-Rebetting Invariant:** Claiming winnings or refunds must NEVER generate a new trade or append a new position. The signing flow updates existing positions in client `localStorage` to `isClaimed = true`, syncs Supabase via `claimUserPositionsAsync()`, and dispatches a celebratory payout announcement to the group chat.
* **Strict Expired Market Trading Block:** The moment `cutoffAt` passes or `phase === 'resolved'`, no BUY trade can be approved across any surface. Client-side `/sign` pre-validates expiration before wallet prompting, and backend `/api/sessions/[id]/submit` returns 400 `MARKET_CLOSED` / `MARKET_RESOLVED` for trades while permitting claims.

---

## 8. Multi-Surface Parity Invariants (WebApp, TMA, Telegram Bot, Discord Bot)

### 1. Consistent Settled Outcome Badges Across All Surfaces
Every prediction market position display across all client surfaces must render identical outcome semantics:
* `🟢 YES WON`: Market resolved YES. Winning YES shares pay out at $1.00 USDC each.
* `🟣 NO WON`: Market resolved NO. Winning NO shares pay out at $1.00 USDC each.
* `⚪ VOID (Canceled)`: Event canceled or unresolvable. 100% principal USDC refunded.
* `⏳ In Progress` / `⏳ Trading Closed`: Market either actively trading or awaiting AI Oracle cutoff evaluation.

### 2. Universal 1-Tap Claim Experience
* **Telegram Bot (`/positions`):**
  * Displays user's recent bets with market titles, bet stance, settled badge, and status.
  * If user holds winning or refundable shares, generates an ephemeral claim session (`sess_claim_...`) and presents a direct 1-tap button: `⚡ 💰 Claim Payout ($X.XX USDC) (Mini App)` that opens inside Telegram via WebApp SDK, plus a fallback external browser link.
* **Discord Bot (`/positions` & `btn_positions`):**
  * Renders an interactive `EmbedBuilder` listing each position with full title, stance, settled result badge, and status.
  * Dynamically attaches a `💰 Claim Payout ($X.XX USDC)` button directing the user to `/sign?session=...`.
* **Telegram Mini App & Mobile WebApp (`/positions`):**
  * Mobile card view displays category, settled result pill (`🟢 Settled: YES WON`, `🟣 Settled: NO WON`, `⚪ Settled: VOID`), stance, cost vs. value, PnL, and payout status.
  * Immediate 1-tap `💰 Claim Winnings` or `💰 Claim 100% Refund` action button.
  * Aggregates total claimable balance per market so multi-tranche bets are claimed in a single transaction.
* **Desktop WebApp (`/positions`):**
  * Data table provides the dedicated `Settled Result` column with corresponding claim buttons, transitioning to `🟢 Won • Claimed ✓` or `⚪ Refund Claimed ✓` post-confirmation.

