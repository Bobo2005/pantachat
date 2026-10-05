# PantaChat 🐾⚡

> **AI-Powered Non-Custodial Prediction Markets on Solana for Telegram & Discord**

PantaChat turns any group chat or direct message into a full prediction market trading floor. Draft new prediction markets in natural language using conversational AI, trade custom YES/NO amounts with automated bonding curves, manage portfolios, and claim creator royalties with seamless non-custodial signing via Phantom, Solflare, or Telegram Mini App.

---

## 🌟 Key Features

- 🤖 **Conversational Market Creation**: Draft complete prediction markets simply by typing a sentence in natural language. Claude Sonnet 5.5 standardizes title, categories, cutoff dates, and verifiable resolution criteria.
- 🎯 **Flexible Custom Bet Amounts**: Set any arbitrary amount you want to wager ($1, $15, $75, $250, $1,000+) across all surfaces (WebApp numeric input, Telegram Mini App, Telegram Bot `/bet`, and Discord `/bet`), with real-time payout and shares estimation.
- 🛡️ **Duplicate Market Prevention**: Real-time Supabase deduplication prevents redundant questions from being launched across WebApp, Telegram, or Discord.
- ⚡ **Non-Custodial Solana Architecture**: No custodial keys. Users sign transactions directly with their own wallets (Phantom, Solflare, Backpack).
- 💧 **Frictionless Demo Funds Faucet**: Instant Devnet SOL transfers directly to user wallets without requiring third-party OAuth/GitHub connections, backed by 24h rate-limiting and cross-bot confirmation alerts.
- 📜 **Soft Archiving (Market History)**: When a market resolves, it automatically transitions from the active explorer into the "Past / History" tab, keeping user positions and winnings claimable indefinitely.
- 📱 **Responsive Multi-Screen Experience**: Native-feeling UI across Desktop, Tablets, Mobile Web, and Telegram Mini Apps (TMA) with a fixed mobile bottom navigation bar and mobile-first card views.
- 📈 **Bonding Curve Liquidity**: Instant buying and selling via automated bonding curve pricing with slippage safeguards.
- 💰 **Creator Royalties & Rewards**: Market creators earn a percentage of all trading volume generated on their markets, claimable on-demand.
- 💬 **Multi-Platform Parity**: Full feature parity across **Telegram Bot**, **Discord Bot**, and **Next.js WebApp**.

---

## 📂 Repository Structure

```
pantachat/
├── assets/                     # Brand logos in PNG, JPG, WEBP, GIF & SVG (white & dark backgrounds)
├── src/                        # Bot & Backend Service (TypeScript)
│   ├── bot/                    # Telegram & Discord bot command handlers
│   │   ├── telegram/           # Telegraf bot, inline cards, custom bet routing
│   │   └── discord/            # Discord.js slash commands, embeds, interaction router
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
│   ├── public/                 # Static assets, manifests, and white/dark logo variants
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
| `/market <prompt>` | Draft a new prediction market using natural language AI (with deduplication) |
| `/bet <id> <yes\|no> <amount>` | Place a custom amount bet on any market (e.g. `/bet mkt_abc yes 75`) |
| `/bet <yes\|no> <amount>` | Reply directly to any in-chat market card to bet instantly (e.g. `/bet yes 50`) |
| `/faucet [wallet]` | Request test Devnet SOL directly to your wallet (24h cooldown) |
| `/positions` | Check open positions, PnL, and claimable winnings |
| `/earnings` | Check creator royalties & claim graduated fees |
| `/leaderboard` | Top community predictors by trading volume and trades |
| `/help` | Detailed command guide and how prediction markets work |

### Discord Slash Commands
| Command | Description |
| :--- | :--- |
| `/market query:<text>` | Claude AI drafts market rules from chat banter or displays an existing market card |
| `/bet market_id:<id> outcome:<yes\|no> amount:<number>` | Place a custom amount bet and receive an instant non-custodial signing link |
| `/positions` | View your active prediction bets and claimable payouts (ephemeral / private) |
| `/earnings` | Check your creator royalties and graduation status |
| `/leaderboard` | View top community predictors by trading volume |
| `/faucet wallet:<address>` | Request Devnet SOL for testing (strictly 1 claim per 24 hours) |
| **Right Click Message $\to$ Apps $\to$ "Make a prediction market"** | Converts any message in your server into an on-chain prediction market draft |

---

## 🛠️ Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm`
- **Solana Wallet**: Phantom, Solflare, or any browser extension wallet set to **Solana Devnet**
- **Supabase Project**: Free-tier Supabase project for persistent cloud storage
- **Discord Bot**: Created in Discord Developer Portal (see Discord setup below)

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
TELEGRAM_BOT_USERNAME=your_bot_username
DISCORD_CLIENT_ID=your_discord_application_id
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_test_server_id # Optional: enables instant slash command sync
ANTHROPIC_API_KEY=sk-ant-...

# WebApp URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Discord Bot Setup & Slash Command Registration

Follow this step-by-step guide to configure your Discord Bot:

1. **Create Application in Discord Developer Portal:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications).
   - Click **New Application**, name it (e.g. `PantaChat`), and accept terms.
   - Go to **Bot** $\to$ Click **Reset Token** to copy your `DISCORD_BOT_TOKEN`.
   - Go to **General Information** to copy your `DISCORD_CLIENT_ID` (Application ID).
   - *(Optional but recommended)* Set the bot avatar to [`assets/panta-logo-white.png`](file:///assets/panta-logo-white.png) or [`webapp/public/panta-logo-white.png`](file:///webapp/public/panta-logo-white.png) for high-contrast visibility.

2. **Configure Bot Permissions & Scopes:**
   - Go to **OAuth2** $\to$ **URL Generator**:
     - **Scopes:** Select `bot` and `applications.commands`.
     - **Bot Permissions:** Select `Send Messages`, `Embed Links`, `Attach Files`, `Read Message History`, and `Use Slash Commands`.
   - Copy the generated URL and open it in your browser to invite the bot to your server.

3. **Instant Command Registration:**
   - In your `.env`, set `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, and optionally `DISCORD_GUILD_ID` (right-click your test server name in Discord with Developer Mode enabled to copy Server ID).
   - Run the registration script:
     ```bash
     npm run register:discord
     ```
   - *(If `DISCORD_GUILD_ID` is set, slash commands update instantly in your server. If registering globally without a guild ID, Discord takes 5–15 minutes to propagate commands).*

### 5. Running Locally
Run the backend server and bots:
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

## 🎨 Branding & Visual Assets

Brand assets are pre-formatted for Discord avatars, web banners, and socials in both `assets/` and `webapp/public/`:

| File | Specs | Purpose |
| :--- | :--- | :--- |
| [`panta-logo-white.png`](file:///assets/panta-logo-white.png) | 1024x1024, ~11 KB | Discord Bot Avatar & Twitter PFP (Clean White Canvas) |
| [`panta-logo-white.jpg`](file:///assets/panta-logo-white.jpg) | 1024x1024, ~28 KB | Universal JPG Avatar |
| [`panta-logo-white.webp`](file:///assets/panta-logo-white.webp) | 1024x1024, ~12 KB | Modern Web Asset |
| [`panta-logo-white.gif`](file:///assets/panta-logo-white.gif) | 512x512, ~5 KB | Animated/GIF Discord Avatar |
| [`panta-logo-white.svg`](file:///assets/panta-logo-white.svg) | Scalable Vector | High-DPI UI Badges |
| [`panta-logo-black.svg`](file:///webapp/public/panta-logo-black.svg) | Scalable Vector | Dark-Mode Interfaces |

---

## 📱 Mobile & Telegram Mini App (TMA) Support

- **Safe Viewports**: Full viewport stabilization disabling iOS zoom and adapting to Telegram sheet heights.
- **Mobile Bottom Navigation Bar**: Fixed bottom thumb navigation for Explorer, Positions, 1-tap Create Market, Creator Royalties, and Demo Faucet.
- **Card-Based Mobile Views**: Dense financial tables automatically adapt into clean cards with prominent YES/NO badges and 1-tap payout buttons.
- **Custom Amount Editor on `/sign`**: Adjust bet sizes directly on the signing screen prior to transaction approval.
- **Flexible In-Chat Bet Sizes**: Place any custom bet amount via `/bet <id> <yes|no> <amount>` in Telegram or `/bet` in Discord.

---

## 🌐 Deployment

- **Web Companion (`webapp/`)**: Ready for 1-click deployment on [Vercel](https://vercel.com) with standard Next.js settings.
- **Backend / Bot (`src/`)**: Deployable to Render, Railway, Fly.io, or any VPS running Node.js.

---

## 🛡️ License

MIT License © 2026 PantaChat. All rights reserved.
