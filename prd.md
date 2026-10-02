# Product Requirements Document (PRD) — PantaChat

## 1. Product Overview
PantaChat is an everyday conversational prediction layer and non-custodial trading suite for Telegram and Discord, powered natively by the Panta API on Solana. It enables any chat member to reply to a casual message with `/market`, triggering an AI drafting agent that formats a valid prediction market. Once confirmed and signed by the creator, an interactive live card is published into the chat where group members can trade YES/NO shares using preset buttons, track group leaderboards, receive automated winner claim alerts upon settlement, and allow creators to claim royalties upon market graduation.

---

## 2. Core User Personas & Use Cases
1. **The Group Alpha / Banter Trader:** Debates in Telegram/Discord alpha groups and wants to put real stakes behind bold predictions without forcing friends to register on an external website.
2. **The Community Leader / Influencer:** Runs a community and wants engaging daily activities that generate passive creator revenue (creator fees unlocked upon graduation).
3. **The Casual Participant:** Taps `[YES $5]` on a Telegram card, connects their Phantom mobile wallet inside a native modal, and confirms in 5 seconds.

---

## 3. Product Features & Functional Requirements

### 3.1 Headline Flow: "Reply-to-Market"
* **Input:** Reply to any message with `/market` in Telegram, or right-click $\to$ Apps $\to$ "Make a market" in Discord.
* **AI Parser:** Claude Sonnet 5.5 (`claude-sonnet-5-5`) parses the replied text:
  * Generates crisp `question` (max 512 chars).
  * Generates verifiable `resolutionRule` with Ambiguity Guard (max 2048 chars).
  * Curates `sourcesOfTruth` (up to 20 valid URLs).
  * Assigns allowlisted `category` (`sports`, `crypto`, `politics`, `entertainment`, `finance`, `science`, `world`, `other`).
  * Establishes `startTime`, `endTime`, `resolutionTime`.
  * Detects live/breaking events: sets `marketType: "breaking"` and `eventInProgress: true` if the event is already underway.
* **Creator Confirmation:** Bot displays draft summary + estimated fee (~50 USDC) + a 1-tap "Sign to Deploy" button.
* **Signing & Publishing:**
  * Opens signing webview modal (Telegram Mini App or web link).
  * Queries `POST /markets/create/quote/` with creator wallet.
  * Queries `POST /markets/create/build/` to retrieve unsigned `VersionedTransaction`.
  * Creator approves in Phantom; transaction is broadcast on Solana RPC.
  * Calls `POST /markets/register/` with `createId` + `signature`.
  * Replaces draft message with live, interactive Market Card in chat.

### 3.2 Live Interactive Market Cards
* **Visuals:** Unicode sentiment bar (`YES 68% [🟩🟩🟩🟩🟩🟩🟩🟥🟥🟥] 32% NO`), total volume, trader count, countdown timer.
* **Actions:** Inline buttons for `[YES $5]`, `[YES $20]`, `[NO $5]`, `[NO $20]`, `[Custom]`, `[🔄 Refresh]`.
* **In-Place Refresh:** `🔄 Refresh` invokes `editMessageReplyMarkup` / `interaction.update()` to update odds without sending spam messages.
* **Timing Enforcement:** If `now < startTime`, card displays "Opens in X" and buy buttons are disabled (preventing `MARKET_NOT_IN_PRIMARY` errors).
* **Secondary State:** When graduated, card displays "Graduated to Secondary" and replaces buy buttons with "Trade on Panta" link-out.
* **Settlement State:** When resolved, card highlights winning outcome and presents "Claim Winnings" button for eligible holders.

### 3.3 Buy Order Flow & State Machine
* **Order Initiation:** Tapping a preset amount generates a 90-second session.
* **Pipeline:**
  1. `POST /primaryorderquote/` with buyer wallet, market ID, side, decimal amount (`"20.00"`), and attribution `userId`.
  2. `POST /primaryorderbuild/` with `maxSlippageBps: 300` (3%) and `userId`.
  3. Client compiles `instructions` + `recentBlockhash` into a versioned transaction.
  4. Wallet signs $\to$ broadcasts on RPC $\to$ stores signature.
  5. `POST /primaryordersubmit/` (fire-and-forget).
  6. Poll `POST /primaryorderverify/` until status reaches `confirmed`.
  7. On confirmation, push immediately to local ledger (`status: "pending_indexer"`) and call `POST /trades/` to log attribution (primary attribution mechanism).

### 3.4 Portfolio & Community Commands
* **`/positions`:** Queries `GET /positions/?wallet=` and displays share counts, side, mark-to-market value (`shares * yesPrice`), and claim eligibility. (Discord: Ephemeral message).
* **`/leaderboard`:** Ranks group members by net PnL and volume from the internal ledger.
* **`/earnings`:** Queries `POST /claim/creator-fees/build/` for creator wallets to view claimable fees (`claimableFeesUsdc`) for graduated markets. Handles `MARKET_NOT_GRADUATED` cleanly.
* **Winner Claim Alerts:** Automated background watcher checks resolved markets and alerts winning share holders with a direct 1-tap claim link.

### 3.5 Full Demo Sandbox Environment
* **100% Live Demo Mode:** The entire MVP runs natively in Demo / Test Mode on Solana Devnet and the Panta Staging API (`https://staging-api.panta.market/api/v1`) with zero real-money risk.
* **Instant Onboarding Faucet:** Includes a built-in `/faucet` command in chat and a "Get Demo Funds" button in the Mini App / WebApp to instantly airdrop Devnet SOL and test USDC to any user or judge.
* **Pre-Seeded Demo Markets:** Staging catalog pre-seeded with 50 live prediction markets across Crypto, Sports, and Tech so users can trade immediately.
* **Visual Demo Badges:** All interactive cards, Mini App modals, and companion pages display a prominent `[ 🧪 Demo Mode (Devnet) ]` indicator.

---

## 4. Non-Functional & Security Requirements
1. **Non-Custodial:** Server never stores, handles, or requests private keys. All signing occurs client-side in Phantom/Solflare via `@solana/wallet-adapter-react`.
2. **Quota Optimization:** Respects strict Panta API rate limits (Reads: 120/min, Positions: 60/min, Builds: 20/min). Build endpoints are never polled in the background.
3. **Fail-Closed Verification:** Store signatures immediately upon broadcast; retry register/report idempotently.
4. **Data Normalization:** Centralized helper converts between human decimal strings (`"20.00"`) and 6-decimal integer base units (`20000000`).
5. **Config Switchability:** Environment toggle between Staging (`staging-api.panta.market` + Devnet) and Production (`live-api.panta.market` + Mainnet).
