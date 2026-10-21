# PantaChat: Developer Handoff & Quickstart Guide
**Project:** PantaChat (Colosseum Crypto World's Fair & Panta Sidetrack)  
**Status:** MVP Fully Functional & Responsive (Desktop, Mobile, Telegram Mini App)  
**Last Updated:** October 5, 2026

---

## 1. Environment Configuration (`.env.example`)

Copy the following to `.env` in the project root:

```bash
# ==========================================
# PANTA API CONFIGURATION
# ==========================================
# Default: Staging / Devnet (Zero-cost test mode)
PANTA_API_BASE_URL=https://staging-api.panta.market/api/v1
PANTA_API_KEY=pk_test_your_staging_key_here

# For Production 1-Line Swap:
# PANTA_API_BASE_URL=https://live-api.panta.market/api/v1
# PANTA_API_KEY=pk_live_your_live_key_here

# ==========================================
# SOLANA BLOCKCHAIN CONFIGURATION
# ==========================================
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
# Private key array or base58 string used by the demo faucet
FAUCET_PRIVATE_KEY=[12,34,...]

# ==========================================
# SUPABASE DATABASE & CLOUD STORAGE
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ==========================================
# BOT CREDENTIALS
# ==========================================
# Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username

# Discord Bot Token (from Discord Developer Portal)
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# ==========================================
# AI AGENT DRAFTER (Claude Sonnet 5.5)
# ==========================================
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-5-5

# ==========================================
# APPLICATION & WEBAPP URLS
# ==========================================
PORT=3001
WEBAPP_PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# For Telegram Mini App in production / tunnel:
# NEXT_PUBLIC_APP_URL=https://xxxx.ngrok-free.app
```

---

## 2. Completed Architecture & Milestones

1. **Market Deduplication Engine**:
   - Integrates Supabase lookup before any market creation transaction is signed.
   - Prevents duplicate questions across WebApp, Telegram Bot (`/create`), and Discord Bot.
2. **Soft Archiving (Market History)**:
   - When markets resolve, status transitions to `resolved` and outcome is recorded (`yes` / `no`).
   - Automatically migrates from the active explorer feed into a dedicated **Past / History** tab.
   - Preserves user positions and claims permanently.
3. **Frictionless Demo Funds Faucet**:
   - Allows users to claim Devnet SOL directly to their connected Solana address without GitHub verification.
   - Backend enforces a 24-hour rate limit per address.
   - Triggers cross-platform confirmation alerts in Telegram and Discord containing explorer links.
4. **Universal Responsive Design**:
   - Optimized for Desktop ($\ge 1024\text{px}$), Tablet ($768\text{px}$), and Mobile / Telegram Mini App ($360\text{px}$–$430\text{px}$).
   - Viewport stabilization (`viewportFit: "cover"`, anti-zoom).
   - Fixed mobile bottom navigation bar (`Explorer`, `Positions`, `✨ Create`, `Royalties`, `Faucet`).
   - Mobile-first card view for open positions and winnings claims.
5. **Security & Deployment Hygiene**:
   - Clean git state with strictly ignored `.env` and `.env.local`.
   - Vercel-ready WebApp and Render-ready bot/backend.
6. **Immediate Trading Cutoff Protection**:
   - The second `Date.now() > cutoffAt`, betting is immediately disabled across WebApp and Bots.
   - Quick Buy modal displays `⏳ Trading Closed` and disables confirmation.
   - WebApp Submit API (`/api/sessions/[id]/submit`) rejects any buy attempts with 400 `MARKET_CLOSED`.
   - Telegram & Discord bots display `⏳ Trading Closed (Awaiting Resolution)` badge, removing buy buttons or replacing them with details/closed tags.
   - Stale callback buttons from past messages reject trading with `"❌ Trading has ended for this market."`.
7. **Evidence-First AI Oracle Engine (Phase 1)**:
   - Database schema lifecycle columns: `resolution_status` (`'open'`, `'closed'`, `'proposed'`, `'resolved'`, `'disputed'`, `'void'`), `proposed_outcome`, `dispute_until`, `evidence_url`, `evidence_summary`, `confidence_score`, `dispute_count`, and `dispute_reason`.
   - Deterministic AI verification engine (`src/services/ai-oracle.ts`) with strict temperature 0.0, extraction of official sources, and Zod structured output schema.
   - Strict 95% confidence threshold: if confidence < 0.95 or event has not finished, markets remain unconfirmed with zero guessing.
8. **Automated Resolution Poller & 2-Hour Challenge Window (Phase 2)**:
   - Background poller (`src/services/resolution-poller.ts`) running every 60 seconds:
     - Detects expired markets (`cutoffAt <= now` and status `open`/`closed`).
     - Triggers deterministic AI verification.
     - Sets `resolution_status = 'proposed'`, sets `proposed_outcome`, and starts 2-hour dispute window (`dispute_until = now + 7200`).
     - Broadcasts Proposed Resolution cards with evidence links to Telegram and Discord.
   - Community dispute commands: `/dispute <market_id> <reason>` in Telegram and Discord halts auto-settlement for manual verification.
   - Undisputed markets auto-settle after 2 hours with real-time winner alerts.
9. **Automated Payout Settlement, VOID Refunds & UI/UX (Phase 3)**:
   - **Explorer Grid (`/`)**: Displays amber badge `⏳ PROPOSED: YES WON (2h Challenge)` and opens an interactive **Evidence Sheet Modal** showing official evidence URL, exact match score/price proof, AI confidence score, and 2-hour dispute countdown.
   - **Positions Hub (`/positions`)**:
     - Winning positions (`Status: WON`) evaluated at $1.00 USDC per share with active `Claim Winnings` button.
     - Canceled events (`Status: VOIDED`): 100% refund safety net returning 100% of deposited USDC with `Claim 100% Refund` button.
   - **Signing Session (`/sign`)**: Allows claim and refund withdrawals on expired/resolved markets without trade closure blockage.
   - **Bot Transparency Commands**: `/oracle <market_id>` in Telegram and Discord displaying AI Oracle verification log, confidence score, source URL button, timestamps, and dispute status.
   - **Test Suite Verification**: Verified with `scripts/test_phase1_oracle.ts`, `scripts/test_phase2_resolution_pipeline.ts`, and `scripts/test_phase3_settlement_and_oracle.ts` (100% passing, 0 TypeScript compilation errors).

---

## 3. Quickstart Commands

### 1. Install Dependencies
```bash
# In the root pantachat folder:
npm install

# In the webapp folder:
cd webapp && npm install && cd ..
```

### 2. Start Local Services

**Terminal 1 (Telegram & Discord Bot + Express API):**
```bash
npm run dev
# Starts src/index.ts via tsx / nodemon on port 3001
```

**Terminal 2 (Next.js WebApp & Telegram Mini App):**
```bash
cd webapp
npm run dev
# Starts Next.js on http://localhost:3000
```

### 3. Register Discord Slash Commands
```bash
npm run register:discord
```
*(If `DISCORD_GUILD_ID` is set in `.env`, commands sync to that test guild instantly. Otherwise, Discord takes 5-15 mins to propagate globally).*

### 4. Run Automated Test Suites
```bash
# Test Phase 1: Database Schema & AI Oracle Verification Engine
npx tsx scripts/test_phase1_oracle.ts

# Test Phase 2: Automated Resolution Poller & 2-Hour Dispute Window
npx tsx scripts/test_phase2_resolution_pipeline.ts

# Test Phase 3: Payout Settlement, 100% VOID Refunds & Bot /oracle Commands
npx tsx scripts/test_phase3_settlement_and_oracle.ts

# Full TypeScript check (Zero compilation errors)
npx tsc --noEmit
npm --prefix webapp run build
```

---

## 4. Evaluator Verification Flow (Devnet & Staging)

1. **Free Devnet SOL via Built-in Faucet:**
   - Open WebApp and click the **💧 Faucet** button in the header or bottom bar.
   - Enter your Phantom/Solflare address or use the `/faucet <wallet>` command in chat.
   - Receives Devnet SOL instantly without requiring any OAuth or GitHub account.
2. **Explore Active & Past Markets:**
   - View active markets with real-time bonding curves.
   - Switch to the **Past / History** tab to view settled markets.
3. **Custom Amount Non-Custodial Trading:**
   - **WebApp Quick-Buy Modal:** Click YES or NO on any market card. Enter any custom amount (e.g. `$35`) or tap quick pills (`$5`, `$10`, `$20`, `$50`, `$100`). View live estimated shares and potential returns.
   - **Signing Portal `/sign` Live Adjuster:** On the review step, tap `✏️ Custom Amount` to fine-tune your bet size before wallet approval. The transaction instruction and SPL Memo dynamically recompile.
   - **Telegram Bot Betting:** Type `/bet <marketId> <yes|no> <amount>` (e.g. `/bet mkt_abc yes 75`), or reply directly to any market card with `/bet yes 50`.
   - **Discord Bot Betting:** Run `/bet market_id:<id> outcome:<yes|no> amount:<number>` to receive an instant signing link with pre-calculated shares.
4. **Natural Language Market Drafting:**
   - In Telegram: Type `/market Will Solana hit $300 before Christmas?`
   - In Discord: Type `/market query:Will BTC reach 150k this year?`
   - Claude Sonnet 5.5 formats the question, creates objective resolution rules, validates deduplication in Supabase, and generates the signing session.
5. **Automated AI Oracle & Resolution Inspection:**
   - The engine automatically locks trading the millisecond `cutoffAt` passes.
   - AI Oracle evaluates authoritative resolution sources with strict temperature 0.0 and $\ge 95\%$ confidence.
   - Inspect live verification logs via `/oracle <market_id>` in Telegram and Discord.
6. **2-Hour Challenge Window & Disputes:**
   - Proposed outcomes enter a 2-hour dispute window (`dispute_until = now + 7200`).
   - Traders can challenge with `/dispute <market_id> <reason>` in chat to freeze settlement for consensus review.
7. **Claim Winnings, 100% VOID Refunds & Royalties:**
   - Navigate to **Positions** (`/positions`) on WebApp, Mobile, TMA, or run `/positions` in Telegram/Discord.
   - Winning shares pay out at $1.00 USDC each; canceled/unresolvable events refund 100% of deposited USDC.
   - Direct 1-tap claim buttons generate non-custodial Solana transactions (`PantaChat:Claim:<marketId>`).
   - Navigate to **Royalties** (`/earnings`) to view and claim creator fees accrued upon market graduation.

---

## 5. Visual Brand Assets Catalog

Brand assets are located in [`assets/`](file:///assets/) and [`webapp/public/`](file:///webapp/public/):
- **[`panta-logo-white.png`](file:///assets/panta-logo-white.png)**: 1024x1024 white-background avatar for Discord Bot profile and socials.
- **`panta-logo-white.jpg`**, **`panta-logo-white.webp`**, **`panta-logo-white.gif`**, **`panta-logo-white.svg`**: Multi-format exports under 10MB.
- **`panta-logo-black.svg`**: Scalable vector for dark UI themes.

---

## 6. Competitive Moat & Hackathon Positioning

| Dimension | PantaChat 🐾⚡ | Competitors *(Polymarket Bots, Discord Info Bots)* |
| :--- | :--- | :--- |
| **Panta Ecosystem** | **First & Only Trading Client** | No official or 3rd-party bots exist (only read-only dashboards) |
| **Security** | **100% Non-Custodial** (Phantom/Solflare via TMA) | Mostly custodial (hot wallets generated by bots, private key export) |
| **Market Creation** | **"Reply-to-Market" via Claude Sonnet 5.5** | Only trading pre-existing markets; no on-the-fly conversational creation |
| **Oracle & Settlement**| **AI Oracle + 2h Dispute + 100% VOID Refund** | Manual creator resolve or centralized UMA relay |
| **Lifecycle Depth** | **Full Cycle** (Create $\to$ Trade $\to$ History $\to$ Claims $\to$ Royalties) | Simple Buy button only |
| **Multi-Surface** | **Telegram, Discord, TMA, and WebApp** | Single platform (Telegram-only or Discord-only) |

---

## 7. Submission Checklist (Colosseum & Superteam Earn)

- [x] Market deduplication and soft-archiving active.
- [x] Zero-friction Devnet faucet active with 24h limit.
- [x] Universal responsive layout tested on desktop, mobile, and TMA.
- [x] Custom bet amount system active across WebApp, `/sign`, Telegram, and Discord.
- [x] Discord Bot slash commands & AI natural language routing verified.
- [x] White & dark background brand logo assets formatted and saved.
- [x] Automated AI Oracle with temperature 0.0, $\ge 95\%$ confidence guard, and cutoff lockout.
- [x] 2-Hour dispute challenge window and community `/dispute` command active.
- [x] $1.00/share payout economics and 100% VOID refund safety net verified.
- [x] Multi-device parity across Desktop WebApp, Mobile Web, Telegram Mini App, Telegram Bot, and Discord Bot.
- [x] 1-Tap claim sessions for winnings and refunds on all surfaces.
- [x] Zero sensitive secrets in git tracking.
- [x] WebApp builds cleanly with `next build` and 0 TypeScript compilation errors.
- [x] Pushed repository to GitHub (`Bobo2005/pantachat`).
- [x] Deployed WebApp to Vercel ([pantachat.vercel.app](https://pantachat.vercel.app)).
- [ ] Submit to **Colosseum Crypto World's Fair** and **Panta API Sidetrack**.
