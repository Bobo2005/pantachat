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
5. **Claim Winnings & Royalties:**
   - Navigate to **Positions** (`/positions`) to claim resolved market winnings.
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
- [x] Zero sensitive secrets in git tracking.
- [x] WebApp builds cleanly with `next build`.
- [ ] Push repository to GitHub.
- [ ] Deploy WebApp to Vercel and Backend to Render.
- [ ] Submit to **Colosseum Crypto World's Fair** and **Panta API Sidetrack**.
