# PantaChat 🐾⚡

> **AI-Powered Non-Custodial Prediction Markets on Solana for Telegram & Discord**

PantaChat turns any group chat or direct message into a full prediction market trading floor. Draft new prediction markets in natural language using conversational AI, buy Yes/No shares, manage portfolios, and claim creator royalties with seamless non-custodial signing via Phantom, Solflare, or Telegram Mini App.

---

## 🌟 Key Features

- 🤖 **Conversational Market Creation**: Draft complete prediction markets simply by typing a sentence. Claude AI standardizes title, categories, cutoff dates, and resolution criteria.
- ⚡ **Non-Custodial Solana Architecture**: No custodial keys. Users sign transactions directly with their own wallets (Phantom, Solflare, Backpack).
- 📱 **Mobile & Mini App Ready**: Universal deep-linking (`phantom://`, `solflare://`) for mobile browsers and native Telegram WebApp support.
- 📈 **Bonding Curve Liquidity**: Instant buying and selling via automated bonding curve pricing with slippage safeguards.
- 💰 **Creator Royalties & Rewards**: Market creators earn a percentage of all trading volume generated on their markets, claimable on-demand.
- 💬 **Multi-Platform**: Full feature parity across **Telegram Bot** and **Discord Bot**.

---

## 📂 Repository Structure

```
pantachat/
├── src/                        # Bot & Backend Service (TypeScript)
│   ├── bot/                    # Telegram & Discord bot command handlers
│   │   ├── telegram.ts         # Telegraf bot, inline keyboards, mini app
│   │   └── discord.ts          # Discord.js slash commands & embeds
│   ├── api/                    # Express API server for quote & session brokering
│   │   ├── server.ts           # REST endpoints (/api/sessions, /api/portfolio)
│   │   └── panta/              # Panta protocol client (create, buy, claim)
│   ├── ai/                     # AI Market Drafter (Claude Sonnet 5.5)
│   ├── db/                     # Drizzle ORM + SQLite database schema & queries
│   └── utils/                  # Solana RPC connection, memo builders & helpers
├── webapp/                     # Web Companion & Signing Interface (Next.js 16)
│   ├── src/app/                # App router (Landing, /sign, /positions, /earnings)
│   ├── src/components/         # Solana Wallet Provider & Telegram Context
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
| `/create <prompt>` | Draft a new prediction market using natural language AI |
| `/markets [category]` | Browse trending and active prediction markets |
| `/market <id>` | View real-time bonding curve price, odds, and volume for a market |
| `/portfolio` | Check open positions, PnL, and claimable winnings |
| `/claim` | Claim winnings from resolved markets or creator royalties |
| `/help` | Detailed command guide and how prediction markets work |

### Discord Slash Commands
- `/create prompt:<text>` — AI drafts a new prediction market
- `/markets category:<crypto|sports|politics>` — Explore active markets
- `/market id:<market_id>` — Detailed odds, 24h volume, and quick-trade buttons
- `/portfolio` — View positions and unclaimed balance
- `/claim` — Claim market payouts directly to your wallet

---

## 🛠️ Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm`
- **Solana Wallet**: Phantom, Solflare, or any browser extension wallet set to **Solana Devnet**

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
Fill in your API credentials in `.env`:
```env
PANTA_ENV=staging
PANTA_API_KEY=pk_test_...
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DISCORD_BOT_TOKEN=your_discord_bot_token
ANTHROPIC_API_KEY=sk-ant-...
WEBAPP_URL=http://localhost:3000
```

### 4. Database Setup
Initialize the SQLite database with Drizzle:
```bash
npm run db:push
```

### 5. Running Locally
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

## 🌐 Deployment

- **Web Companion (`webapp/`)**: Ready for 1-click deployment on [Vercel](https://vercel.com) with standard Next.js settings.
- **Backend / Bot (`src/`)**: Deployable to Railway, Render, Fly.io, or any VPS running Node.js.

---

## 🛡️ License

MIT License © 2026 PantaChat. All rights reserved.
