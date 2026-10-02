# PantaChat: Master Build Plan (v4.2 - Production & Everyday Consumer Edition)

**Product Name:** PantaChat  
**Vision:** The everyday conversational prediction layer for Telegram & Discord (built for real long-term consumer use, launched at Colosseum Crypto World's Fair + Panta Sidetrack)  
**Target:** **1st Place ($2,000 USDG) + Long-Term Production App**  
**Plan Date:** October 2, 2026  
**Environment Mode:** **Staging / Devnet for Hackathon $\to$ 1-Line Switch to Mainnet for Public Launch**

---

## Executive Summary: Beyond a Hackathon Project

Most hackathon entries are disposable prototypes that die after judging. **PantaChat is architected as a real, scalable, everyday consumer product.**

Colosseum and Panta explicitly evaluate **"Impact Potential: Real-world use beyond the hackathon."** By building production-grade UI, multi-tenant group support, and non-custodial wallet UX, PantaChat delivers an everyday experience that communities will continue to use daily to settle friendly debates, wager on sports, and monetize alpha.

---

## 1. The 3 Complete UI Surfaces

PantaChat is not just a text bot; it features **three integrated UI surfaces**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PANTACHAT UI ECOSYSTEM                          │
├─────────────────────────┬───────────────────────┬──────────────────────┤
│ 1. IN-CHAT UI           │ 2. TELEGRAM MINI APP  │ 3. WEB COMPANION APP │
│ (Telegram & Discord)    │ (In-Chat Mobile Modal)│ (Desktop / Mobile)   │
├─────────────────────────┼───────────────────────┼──────────────────────┤
│ • Interactive Cards     │ • 1-Tap Wallet Auth   │ • Global Discovery   │
│ • Sentiment Odds Bars   │ • Order Review Sheet  │ • Portfolio Tracker  │
│ • Preset Quick Buttons  │ • 5-State Stepper     │ • Creator Royalties  │
│ • In-Place Odds Refresh │ • Slippage Settings   │ • Server Leaderboard │
└─────────────────────────┴───────────────────────┴──────────────────────┘
```

### Surface 1: In-Chat Interactive Card (Telegram & Discord)
* **Visual Sentiment Progress Bar:**
  ```text
  ⚽ Champions League: Arsenal vs Real Madrid
  "Will Arsenal qualify for the semi-finals?"
  
  YES 64%  [🟩🟩🟩🟩🟩🟩🟩🟥🟥🟥🟥]  36% NO
  Est. Win Return: 1.56x on YES | 2.78x on NO (Mark-to-Market: $0.64 / $0.36)
  Volume: $4,850 USDC • 38 Traders • Closes in 4h
  
  [ YES $5 ] [ YES $20 ] [ NO $5 ] [ NO $20 ]
  [ ⚙️ Custom ] [ 🔄 Refresh Odds ] [ 📊 Details ]
  ```
* **In-Place Updates:** Tapping `🔄 Refresh` updates odds and progress bars via `ctx.editMessageText()` (to update the sentiment bar text and button odds simultaneously) / `interaction.update()` without spamming the chat with new messages.
* **Secondary Market State:** If a market has already graduated (`phase: secondary`), bonding curve buying is closed. The card replaces buy buttons with `[ 🌐 Trade on Panta Secondary ]` pointing directly to `https://panta.market/market/{id}`.
* **Discord Rich Embeds:** Includes custom hex color bars (Green for Live Primary, Blue for Graduated Secondary, Purple for Resolved).

### Surface 2: Telegram Mini App (TMA) / Native Mobile Signing Sheet
* Built with **Next.js, Tailwind CSS, and `@solana/wallet-adapter-react`**.
* **Zero Browser Bouncing & Fallback:** On mobile Telegram, tapping any action button opens a sleek bottom-sheet modal natively inside Telegram (`web_app: { url }`).
* **Resilient Wallet Fallback:** Includes a 1-tap "Open in External Browser" fallback link if the mobile Telegram webview restricts Phantom/Solflare deep-linking.
* **5-State Visual Stepper:**
  ```text
  [1. Quote] ─── [2. Build] ─── [3. Approve] ─── [4. Confirm]
  
  Order Summary:
  • Buying:       38.40 YES Shares
  • Total Cost:   20.00 USDC
  • Max Slippage: 3.0% (300 bps)
  • Fee:          0.40 USDC
  
  [ Connect Phantom / Solflare ]  ->  [ Sign Transaction ]
  ```
* **Instant Verification:** Shows real-time spinner $\to$ Solana transaction signature link $\to$ auto-closes sheet and updates the group card.

### Surface 3: Thin Web Signing & Portfolio Portal (`/sign` & `/positions`)
* **Scoped MVP Focus:** Kept lean and fast. Since Panta API lacks historical price candles and WebSocket push streams, the web app focuses on core transaction utilities rather than a heavy desktop explorer:
  * **Signing Interface (`/sign`):** Lightweight wallet-adapter page powering TMA bottom sheets and Discord external sign links.
  * **User Portfolio (`/positions`):** Mark-to-market live valuations, active YES/NO holdings, and 1-tap claim center.
  * **Creator Royalties (`/earnings`):** Dashboard where creators monitor graduated markets and claim protocol royalties.

---

## 2. The 3 Unfair Moats

```
[ EXISTING BOTS (PolyBot, Fliprbot) ]          [ PANTACHAT ]
• 1-Player Trading Utility Only                 • Multi-Player Conversational Creation
• Only trade pre-existing markets               • "Reply-to-Create" from raw chat banter
• Drop users immediately after order            • Full Lifecycle (Claim Nudges + Creator Royalties)
• Mostly EVM / Closed Indexers                  • Panta-Native, Solana Devnet/Mainnet Non-Custodial
```

### Moat 1: "Reply-to-Create" (Not Just a Trading Wrapper)
Existing bots are single-player trading wrappers for pre-existing markets. PantaChat allows any chat user to reply `/market` to a message like *"Arsenal chokes tonight"* and have AI instantly construct a valid, on-chain market with rules, sources, and timestamps. **This is Panta's exact core value proposition (permissionless creation).**

### Moat 2: Full Lifecycle Coverage
Competitors abandon users after the buy transaction. PantaChat manages the entire lifecycle:
1. Real-time visual odds card with in-place refresh.
2. Automated winner claim nudges when markets resolve.
3. `/earnings` dashboard where market creators claim their creator fees upon market graduation.

### Moat 3: The "Manifold Thesis" Brought On-Chain
Manifold Markets proved that communities love betting inside Discord channels, but they do it with play money. PantaChat brings this proven mechanic to real on-chain USDC on Solana with Panta.

---

## 3. Competitive Landscape & Positioning

| Category / Product | Platform | Focus | How PantaChat Beats Them |
|---|---|---|---|
| **Panta Rooms** | Web | Social rooms + creation wizard | Panta Rooms is a **destination website**. PantaChat lives natively inside Telegram and Discord conversations where communities already hang out. |
| **Panta Pulse** | Web / RSS | AI news-to-market drafter | Panta Pulse is a **1-way news feed**. PantaChat is conversational and turns organic human group debates into on-chain markets. |
| **Panta Terminal / Scope Tools** | Web | Bloomberg-style analytics terminal | Passive observation tools. PantaChat is an active **volume and user distribution engine**. |
| **Generic Telegram Trading Bots** | Telegram | Polymarket trading & copy-trade | Single-player trading bots for pre-existing EVM markets. Cannot create markets; no interactive group social cards. |
| **Manifold Discord Bot** | Discord | Chat market creation & trading | Restricted to off-chain play money ("Mana"). PantaChat operates with real, non-custodial on-chain USDC on Solana. |

---

## 4. Platform Feasibility & Implementation Matrix

Both Telegram and Discord support all PantaChat features natively, utilizing their respective platform-specific strengths:

| Feature | Telegram Implementation | Discord Implementation | Platform Nuance |
|---|---|---|---|
| **Reply-to-Market** | Reads `message.reply_to_message.text` when `/market` is typed. | Message Context Menu: `ApplicationCommandType.Message` (Right-click message $\to$ Apps $\to$ "Make a market"). | **Discord:** Context menu commands do *not* require privileged `MessageContent` bot intents. |
| **Interactive Card** | Inline Keyboard (`InlineKeyboardMarkup`) with callback buttons. | Action Rows with `ButtonBuilder` + Rich Embed (`EmbedBuilder`). | **Discord:** Embeds support colored status borders (e.g. Green for Live, Purple for Resolved). |
| **In-Place Odds Refresh** | `ctx.editMessageText()` / `editMessageReplyMarkup()`. | `interaction.update()` / `message.edit()`. | Both update in-place without generating chat spam. |
| **Wallet Signing** | **Telegram Mini App (TMA):** Opens signing webview modal via `web_app: { url }`. | **Link Button:** `ButtonStyle.Link` opening `https://app.../sign?session=...` in browser. | **Telegram UX Win:** Mini App keeps users completely inside Telegram during signing. |
| **Private Commands (`/positions`, `/earnings`)** | Public reply or prompt user to check DM. | **Ephemeral Messages:** `flags: MessageFlags.Ephemeral`. | **Discord UX Win:** Only the invoking user sees their balances in a crowded server! |
| **Winner Nudges** | Pings `@username` in chat or sends bot DM if user clicked `/start`. | Mentions `<@userId>` in channel or sends server direct message. | Bot deep-links (`t.me/bot?start=link`) ensure users have active DM sessions. |
| **Visual Odds Bar** | Unicode formatted string: `[🟩🟩🟩🟩🟩🟥🟥]`. | Monospace block inside Embed field. | Identical visual parity across both platforms. |

---

## 5. Architecture & Panta API Integration

* **Staging / Devnet URL:** `https://staging-api.panta.market/api/v1` (Default for zero-cost build & testing)
* **Production Mainnet URL:** `https://live-api.panta.market/api/v1` (1-line `.env` swap for public launch)

### Complete Lifecycle Flowchart
```
┌────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│   Telegram     │ ---> │    PantaChat Core       │ ---> │    Panta Staging API    │
│  Chat /market  │      │  (Claude AI Drafter)    │      │  POST /markets/create/  │
└────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                     │                                │
                                     ▼                                ▼
                        ┌─────────────────────────┐      ┌─────────────────────────┐
                        │   Signing WebApp / TMA  │ <--- │ Unsigned Versioned Tx   │
                        │ (Phantom Devnet Wallet) │      │ (Returned by Panta API) │
                        └─────────────────────────┘      └─────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ Broadcast on Devnet RPC │
                        │ POST /markets/register/ │
                        └─────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ Live Group Market Card  │
                        │ [YES $5] [YES $20] [NO] │
                        └─────────────────────────┘
                                     │ (User buys YES)
                                     ▼
                        ┌─────────────────────────┐      ┌─────────────────────────┐
                        │ Primary Buy Build       │ ---> │ Injects SPL Attribution │
                        │ POST /primaryorderbuild │      │ Memo Instruction        │
                        └─────────────────────────┘      └─────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ 5-State Verify Poller   │
                        │ built->submitted->conf. │
                        └─────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ POST /trades/ (Report)  │
                        │ Update Local Ledger     │
                        └─────────────────────────┘
```

### Complete API Surface Mapping (12/12 Endpoints)

| Capability | Panta API Endpoint | Usage in PantaChat |
|---|---|---|
| **Market Discovery** | `GET /markets/`, `GET /categories/` | Validating categories; market detail lookups |
| **Market Detail** | `GET /markets/{marketId}/` | Fetching live spot prices (`yesPrice`, `noPrice`) |
| **Create Quote** | `POST /markets/create/quote/` | Calculating creation fees & event PDA derivation |
| **Create Build** | `POST /markets/create/build/` | Generating unsigned VersionedTransaction for market |
| **Register Market** | `POST /markets/register/` | Finalizing market on-chain after broadcast |
| **Primary Quote** | `POST /primaryorderquote/` | Simulating share output and fees (~90s TTL) |
| **Primary Build** | `POST /primaryorderbuild/` | Assembling buy instructions with SPL Memo |
| **Submit / Verify** | `POST /primaryordersubmit/`, `verify/` | Managing 5-state order progression |
| **Positions** | `GET /positions/?wallet=` | Powers `/positions` and winner detection |
| **Win Claim** | `POST /claim/build/` | Assembling claim instructions for winners |
| **Creator Fees** | `POST /claim/creator-fees/build/` | Powers `/earnings` for graduated markets |
| **Attribution** | `POST /trades/`, `GET /trades/{sig}/` | Logging partner volume with pseudonymous IDs |

---

## 6. Technical Implementation Details & Guardrails

1. **Preserving the 20/min Build Quota:**  
   * Quotas: Reads (120/min), Positions (60/min), Builds (20/min).  
   * **Rule:** Never background-poll `/claim/build/` or `/claim/creator-fees/build/`. Detect winners via `/positions` (60/min) and only trigger build endpoints when a user explicitly taps "Claim".
2. **USDC Decimal vs. Base Units Normalization:**  
   * Primary quotes/builds use human decimal strings (`"20.00"`).  
   * Verify, creator fees, and creation fees use 6-decimal integer base units (`20000000`).  
   * Standardized via a single `formatUsdc()` / `parseUsdc()` helper module.
3. **Slippage Protection:**  
   * Default `maxSlippageBps: 300` (3%) to prevent bonding curve `QUOTE_STALE` errors on active markets, with automatic 1-tap re-quote fallback.
4. **Trade Attribution:**  
   * Explicitly report every confirmed trade via `POST /trades/` with `{ signature, userId, marketId }`. Note: While Panta docs mention buys with attribution memos can be ingested, automatic memo injection by `POST /primaryorderbuild/` is unverified and treated as an open question; explicit reporting via `POST /trades/` is mandatory.

---

## 7. The 2-Minute Winning Demo Video Storyboard

Judges watch dozens of videos. This exact sequence is designed to maximize engagement and hit every scoring rubric:

| Timestamp | Screen Action | Voiceover / Text Overlay | Rubric Hit |
|---|---|---|---|
| **0:00–0:15** | Telegram group chat. Two members debate: *"Solana flips ETH market cap before 2027!"* vs *"No chance."* | *"Prediction markets shouldn't be destinations you visit alone. They should live inside the conversations where debates actually happen."* | Problem statement & Core thesis |
| **0:15–0:35** | User replies `/market`. Bot pops up instant AI draft with question, rules, and timestamps. Creator taps "Create", signs on Devnet TMA modal. | *"Meet PantaChat. With one reply, Claude drafts the market rules and sources. The creator signs once on Solana Devnet, and PantaChat registers it on Panta."* | Reply-to-Create Moat + Panta Creation API |
| **0:35–0:55** | Live card appears in chat. Another member taps `[YES $20]`. Quick sign in Phantom. Card odds bar dynamically shifts to 72% YES. | *"The group trades directly from the card. PantaChat compiles non-custodial versioned transactions and explicitly reports trade attribution."* | Buy Flow + UX + Attribution |
| **0:55–1:15** | Resolution & Claims (using a pre-resolved market on staging or labeled as simulated flow). Bot alerts winner: *"@bob won 38.4 USDC! [Claim Winnings]"*. Creator types `/earnings` to claim unlocked creator fees from graduation. | *"PantaChat manages the full lifecycle: winner claim alerts, group leaderboards, and creator royalties when markets graduate."* | Full Lifecycle Moat |
| **1:15–1:40** | Show architecture slide: 12/12 Panta APIs, zero-cost Staging/Devnet setup, 1-click Demo Mode switch for judges. | *"Built 100% on the Panta API, fully non-custodial, and production-ready for both Devnet and Mainnet."* | Technical Execution & API Depth |
| **1:40–2:00** | Live traction stats: 4 alpha Telegram groups, real attributed trades. Final slide: "Powered by Panta" + Github + Links. | *"PantaChat: Bringing prediction markets into the conversation. Powered by Panta."* | Traction & Polish |

---

## 8. 10-Day Zero-Cost Execution Timeline

| Day | Date | Milestones |
|---|---|---|
| **1** | **Oct 2** | Register staging account on `staging-api.panta.market/api/v1` (`POST /auth/register/`), mint `pk_test_...` key. Verify health check and catalog reads. Setup repo & database schema. |
| **2** | **Oct 3** | Build lightweight Signing Web App / TMA with Solana Wallet Adapter set to Devnet. Test in-webview Phantom connection with external browser fallback. Test bonding curve minimum buy amount against staging API (handling `AMOUNT_TOO_SMALL`). |
| **3** | **Oct 4** | Implement Telegram `/market` reply handler with AI drafting prompt (rules, sources, breaking flag, categories, Ambiguity Guard) and fee preview. |
| **4** | **Oct 5** | Build interactive Market Card in Telegram with visual odds bars (updated in-place via `ctx.editMessageText`), standardized preset buy buttons ($5, $20, and Custom), secondary market link-out state, and Demo Mode. |
| **5** | **Oct 6** | Port `/market` and card interaction to Discord (`ApplicationCommandType.Message` context menu parity & ephemeral replies). |
| **6** | **Oct 7** | Implement `/positions` and `/leaderboard` using local ledger + cached Panta market details. Build resolution watcher & winner claim alert poller. |
| **7** | **Oct 8** | Implement `/earnings` with creator-fee claiming (handling `MARKET_NOT_GRADUATED` state) and reconciliation cron for stuck create sessions. |
| **8** | **Oct 9** | Polish error banners, attribution cross-checks (`GET /trades/{signature}/`), privacy policy, and test Devnet airdrop flows. |
| **9** | **Oct 10** | **Community Testing Day:** Seed bot in 3–5 friend/community Telegram groups using Devnet wallets and Demo Mode. Collect feedback and verify state transitions. |
| **10** | **Oct 11** | Record demo video highlighting the "Reply-to-Create" hero moment and Devnet signing, write documentation walkthrough, and submit to Colosseum + Superteam Earn. (Oct 12 held as buffer). |

---

## 9. Hackathon Submission Checklist

- [ ] Registered for official Colosseum Crypto World's Fair hackathon
- [ ] Registered for Panta API Sidetrack on Superteam Earn
- [ ] "Powered by Panta" clearly visible on card footer and signing page
- [ ] Working Demo on Devnet + 1-click `/demo` mode for judges
- [ ] GitHub repository public with clean README, setup guide, and MIT/Apache license
- [ ] 2-minute demo video following the Section 7 storyboard uploaded to YouTube/Loom
- [ ] Dual submission confirmed on both platforms before deadline
