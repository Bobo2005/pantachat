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

---

## 4. Evaluator Verification Flow (Devnet & Staging)

1. **Free Devnet SOL via Built-in Faucet:**
   - Open WebApp and click the **💧 Faucet** button in the header or bottom bar.
   - Enter your Phantom/Solflare address or use the `/faucet <wallet>` command in chat.
   - Receives Devnet SOL instantly without requiring any OAuth or GitHub account.
2. **Explore Active & Past Markets:**
   - View active markets with real-time bonding curves.
   - Switch to the **Past / History** tab to view settled markets.
3. **Non-Custodial Trading:**
   - Click YES or NO on any market card $\to$ select preset amount $\to$ Confirm & Sign.
   - Compiles versioned transaction and signs directly with Phantom/Solflare.
4. **Claim Winnings & Royalties:**
   - Navigate to **Positions** to claim resolved market winnings.
   - Navigate to **Royalties** to view creator fees accrued.

---

## 5. Submission Checklist (Colosseum & Superteam Earn)

- [x] Market deduplication and soft-archiving active.
- [x] Zero-friction Devnet faucet active with 24h limit.
- [x] Responsive layout tested on desktop, mobile, and TMA.
- [x] Zero sensitive secrets in git tracking.
- [x] WebApp builds cleanly with `next build`.
- [ ] Push repository to GitHub.
- [ ] Deploy WebApp to Vercel and Backend to Render.
- [ ] Submit to **Colosseum Crypto World's Fair** and **Panta API Sidetrack**.
