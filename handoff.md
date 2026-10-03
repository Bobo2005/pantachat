# PantaChat: Developer Handoff & Quickstart Guide
**Project:** PantaChat (Colosseum Crypto World's Fair & Panta Sidetrack)  
**Status:** MVP Ready for Code Generation  
**Last Updated:** October 2, 2026

---

## 1. Environment Configuration (`.env.example`)

Copy the following to `.env` in the project root:

```bash
# ==========================================
# PANTA API CONFIGURATION
# ==========================================
# Default: Staging / Devnet (Zero-cost hackathon test mode)
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
# Optional: Alchemy / QuickNode / Helius RPC for lower latency
# SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=...

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
# AI AGENT DRAFTER (Claude Sonnet 5.5 - claude-sonnet-5-5)
# ==========================================
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-5-5

# ==========================================
# APPLICATION & WEBAPP URLS
# ==========================================
PORT=3001
WEBAPP_PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# For Telegram Mini App in production / ngrok:
# NEXT_PUBLIC_APP_URL=https://xxxx.ngrok-free.app

# ==========================================
# DATABASE
# ==========================================
DATABASE_URL=file:./pantachat.db
```

---

## 2. Quickstart Commands

### 1. Install Dependencies
```bash
# In the root pantachat folder:
npm install

# In the webapp folder:
cd webapp && npm install && cd ..
```

### 2. Run Database Migrations
```bash
npx drizzle-kit push
```

### 3. Start Local Services
You will typically run two terminals:

**Terminal 1 (Telegram & Discord Bot + Express API):**
```bash
npm run dev
# Starts src/index.ts via tsx / nodemon
```

**Terminal 2 (Next.js Telegram Mini App & Signing Portal):**
```bash
cd webapp
npm run dev
# Starts Next.js on http://localhost:3000
```

---

## 3. Testing on Devnet ($0 Cost)

1. **Free Devnet SOL:**
   - Request test SOL using the Solana CLI: `solana airdrop 2 <YOUR_WALLET> --url devnet`
   - Or via web faucet: `https://faucet.solana.com/`
2. **Staging Panta Markets:**
   - The staging API at `https://staging-api.panta.market/api/v1` comes pre-populated with ~50 active test markets across Crypto, Sports, and Tech.
   - You can test quotes and builds immediately with zero real funds.

---

## 4. Judge & Evaluator Verification Flow (Devnet & Staging)

The entire application runs on the Panta staging environment and Solana Devnet at zero financial cost:

* **Staging API:** Pre-seeded with 50 live prediction markets across Crypto, Sports, and Tech.
* **1-Tap Non-Custodial Devnet Signing:** Judges connect Phantom/Solflare on Devnet (or use pre-funded devnet wallets) to experience real on-chain transaction generation, signing, SPL memo attribution, and live card updates with real test USDC.
* **No Real Funds Required:** Devnet SOL and test tokens allow judges to verify the full creation, trading, and claim lifecycle on actual Solana infrastructure.

---

## 5. Submission Checklist (Colosseum & Superteam Earn)

- [ ] Ensure all 12/12 Panta API routes are wired and functional.
- [ ] Record the 2-minute demo video following `pantachat_plan_v3.md` (Section 7).
- [ ] Push clean code to GitHub repository with open-source license.
- [ ] Submit to **Colosseum Crypto World's Fair**.
- [ ] Submit to **Panta API Sidetrack on Superteam Earn**.
