# PantaChat: AI Agent Memory & Technical Invariants
**File Purpose:** Permanent technical memory for AI coding agents generating and debugging PantaChat.

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
* Note on SPL Memo: While Panta documentation mentions buys with attribution memos can be ingested, automatic SPL Memo injection by `POST /primaryorderbuild/` is unverified. Treat automatic memo injection as an open question for Panta, and always rely on the explicit `POST /trades/` endpoint for attribution.
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

## 2. Environment & Endpoints Configuration

* **Staging / Devnet URL (Default):** `https://staging-api.panta.market/api/v1`
  * Self-registration: `POST /auth/register/` (No KYC, instant `pk_test_...` issuance).
  * Devnet Solana RPC: `https://api.devnet.solana.com`
  * USDC Mint (Devnet): Staging mock USDC.
* **Production / Mainnet URL (1-Line Toggle):** `https://live-api.panta.market/api/v1`
  * Set `PANTA_API_BASE_URL=https://live-api.panta.market/api/v1` in `.env`.
  * Set `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com`.

---

## 3. Platform-Specific Implementation Rules

### Telegram
* Use `Telegraf` framework.
* Use `InlineKeyboardMarkup` for interactive market cards with preset buttons (`$5`, `$20`, and `Custom`).
* Update cards in-place using `ctx.editMessageText(newText, { reply_markup })` to refresh the visual odds bar and button prices simultaneously without chat spam (do NOT use `editMessageReplyMarkup` alone as the odds bar lives in the message text).
* Use Telegram Mini App (`web_app: { url }`) for signing, with an explicit "Open in External Browser" fallback link to ensure Phantom/Solflare mobile deep-linking works smoothly if the in-app webview restricts wallet adapters.
* Markets in `phase: secondary` must display a link-out (`Trade on Panta`) instead of buy buttons, since primary order endpoints only operate on `phase: primary` bonding curves.
* Bot deep-links: `https://t.me/PantaChatBot?start=market_<marketId>` to onboard new group members into private DMs.

### Discord
* Use `discord.js` v14+.
* For Reply-to-Create: Use Message Context Menu command (`ApplicationCommandType.Message`) labeled "Make a prediction market".
  * *Reason:* Does NOT require Discord's privileged `MessageContent` bot intent.
* Use `MessageFlags.Ephemeral` for `/positions` and `/earnings` so personal balances remain private in public servers.
* Use rich embeds with status color coding (Green: Primary, Purple: Secondary, Grey: Resolved).

---

## 4. Common Error Codes & Mitigations

| Error Code | Cause | Automated Mitigation |
|---|---|---|
| `QUOTE_STALE` | Price shifted on bonding curve during user signing delay | Mini App automatically fetches fresh quote and updates stepper with 1-tap re-sign |
| `RATE_LIMIT_EXCEEDED` | Exceeded 20/min build or 120/min read | Request queued in Bottleneck rate limiter with exponential backoff (jitter) |
| `MARKET_NOT_GRADUATED` | Called creator fee claim before secondary phase | UI disables button and displays progress bar: `Liquidity: $X / $10,000 to Graduation` |
| `TX_NOT_FOUND` | Reported trade to `/trades/` before RPC confirmed | Verify poller awaits Solana RPC commitment `confirmed` (or up to 30s timeout) before calling `/trades/` |
| `INVALID_CUTOFF` | Market resolution date is in past or <30m | AI Drafter validates `cutoffAt > Date.now() + 30 * 60 * 1000` before calling create quote |
