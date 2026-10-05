# PantaChat 🐾⚡

> **AI-Powered Non-Custodial Prediction Markets on Solana for Telegram & Discord**

PantaChat turns any group chat or direct message into a full prediction market trading floor. Draft new prediction markets in natural language using conversational AI, buy Yes/No shares, manage portfolios, and claim creator royalties with seamless non-custodial signing via Phantom, Solflare, or Telegram Mini App.

---

## 🌟 Key Features

- 🤖 **Conversational Market Creation**: Draft complete prediction markets simply by typing a sentence. Claude AI standardizes title, categories, cutoff dates, and resolution criteria.
- 🛡️ **Duplicate Market Prevention**: Real-time Supabase deduplication prevents redundant questions from being launched across WebApp, Telegram, or Discord.
- ⚡ **Non-Custodial Solana Architecture**: No custodial keys. Users sign transactions directly with their own wallets (Phantom, Solflare, Backpack).
- 💧 **Frictionless Demo Funds Faucet**: Instant Devnet SOL transfers directly to user wallets without requiring third-party OAuth/GitHub connections, backed by 24h rate-limiting and cross-bot confirmation alerts.
- 📜 **Soft Archiving (Market History)**: When a market resolves, it automatically transitions from the active explorer into the "Past / History" tab, keeping user positions and winnings claimable indefinitely.
- 📱 **Responsive Multi-Screen Experience**: Native-feeling UI across Desktop, Tablets, Mobile Web, and Telegram Mini Apps (TMA) with a fixed mobile bottom navigation bar and mobile-first card views.
- 📈 **Bonding Curve Liquidity**: Instant buying and selling via automated bonding curve pricing with slippage safeguards.
- 💰 **Creator Royalties & Rewards**: Market creators earn a percentage of all trading volume generated on their markets, claimable on-demand.
- 💬 **Multi-Platform**: Full feature parity across **Telegram Bot**, **Discord Bot**, and **Next.js WebApp**.

---

## 📂 Repository Structure

```
pantachat/
├── src/                        # Bot & Backend Service (TypeScript)
│   ├── bot/                    # Telegram & Discord bot command handlers
│   │   ├── telegram.ts         # Telegraf bot, inline keyboards, mini app
│   │   └── discord.ts          # Discord.js slash commands & embeds
│   ├── api/                    # Express API server for quote & session brokering
│   │   ├── server.ts           # REST endpoints (/api/sessions, /api/portfolio, /api/faucet)
│   │   └── panta/              # Panta protocol client (create, buy, claim)
│   ├── ai/                     # AI Market Drafter (Claude Sonnet 5.5)
│   ├── db/                     # Supabase & SQLite queries, deduplication, positions
│   │   ├── supabase.ts         # Cloud persistence client
│   │   ├── queries.ts          # Market deduplication, soft archiving, faucet tracking
│   │   └── schema.ts           # Schema definitions
│   └── utils/                  # Solana RPC connection, memo builders & helpers
├── webapp/                     # Web Companion & Signing Interface (Next.js 16)
│   ├── src/app/                # App router (Explorer, /sign, /positions, /earnings)
│   ├── src/components/         # Navbar (Desktop + Mobile Bottom Bar), WalletButton, Modals
│   ├── src/lib/                # Supabase client, Panta client, Solana provider
│   └── src/utils/              # Mobile wallet deep linking (Phantom/Solflare)
├── scripts/                    # Integration and lifecycle test suites
├── drizzle.config.ts           # Drizzle ORM configuration
└── package.json                # Root package configuration
```

---

## 🚀 Bot Commands

### Telegram Commands
| Command | Description |
| :--- | :--- |
| `/start` | Launch PantaChat, connect wallet, and view quick actions |
| `/create <prompt>` | Draft a new prediction market using natural language AI (with deduplication) |
| `/markets [category]` | Browse trending and active prediction markets |
| `/market <id>` | View real-time bonding curve price, odds, and volume for a market |
| `/faucet [wallet]` | Request test Devnet SOL directly to your wallet (24h cooldown) |
| `/portfolio` | Check open positions, PnL, and claimable winnings |
| `/claim` | Claim winnings from resolved markets or creator royalties |
| `/help` | Detailed command guide and how prediction markets work |

### Discord Slash Commands
- `/create prompt:<text>` — AI drafts a new prediction market
- `/markets category:<crypto|sports|politics>` — Explore active markets
- `/market id:<market_id>` — Detailed odds, 24h volume, and quick-trade buttons
- `/faucet wallet:<address>` — Request Devnet SOL for testing
- `/portfolio` — View positions and unclaimed balance
- `/claim` — Claim market payouts directly to your wallet

---

## 🛠️ Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm`
- **Solana Wallet**: Phantom, Solflare, or any browser extension wallet set to **Solana Devnet**
- **Supabase Project**: Free-tier Supabase project for persistent cloud storage

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Bobo2005/pantachat.git
cd pantachat

# Install backend dependencies
npm install

# Install webapp dependencies
cd webapp && npm install && cd ..
```

### 3. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in your credentials in `.env`:
```env
# Panta Protocol API
PANTA_API_BASE_URL=https://staging-api.panta.market/api/v1
PANTA_API_KEY=pk_test_...

# Solana RPC
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
FAUCET_PRIVATE_KEY=... # Keypair used to distribute devnet SOL to users

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Bots & AI
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DISCORD_BOT_TOKEN=your_discord_bot_token
ANTHROPIC_API_KEY=sk-ant-...

# WebApp URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Running Locally
Run the backend server and bot:
```bash
npm run dev
```

In a separate terminal, launch the Next.js web companion:
```bash
cd webapp
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the webapp.

---

## 📱 Mobile & Telegram Mini App (TMA) Support

- **Safe Viewports**: Full viewport stabilization disabling iOS zoom and adapting to Telegram sheet heights.
- **Mobile Bottom Navigation Bar**: Fixed bottom thumb navigation for Explorer, Positions, 1-tap Create Market, Creator Royalties, and Demo Faucet.
- **Card-Based Mobile Views**: Dense financial tables automatically adapt into clean cards with prominent YES/NO badges and 1-tap payout buttons.

---

## 🌐 Deployment

- **Web Companion (`webapp/`)**: Ready for 1-click deployment on [Vercel](https://vercel.com) with standard Next.js settings.
- **Backend / Bot (`src/`)**: Deployable to Render, Railway, Fly.io, or any VPS running Node.js.

---

## 🛡️ License

MIT License © 2026 PantaChat. All rights reserved.
