# PantaChat 🐾⚡
> **Conversational, AI-Powered & Non-Custodial Prediction Markets on Solana**

---

## Problem Statement: Clearly define the unsolved problem you are addressing.

Prediction markets thrive on opinions, conviction, and community debate. Yet today, **99% of organic crypto debates happen inside Telegram and Discord group chats, but 0% of them convert into active prediction markets on the spot.**

When community members argue over whether a token will flip another, when a protocol upgrade will ship, or who will win an election, that banter dies in the chat history. The reasons for this friction are systemic:

1. **Massive Context Switching & Form Fatigue:** Creating a market on existing platforms (Polymarket, Kalshi, or web DEXs) requires leaving the chat, navigating complex interfaces, and manually writing out resolution rules, dates, and categories. Most users simply abandon the idea.
2. **The Custodial Trap of Telegram Bots:** Traditional Telegram trading bots require users to generate a bot hot-wallet or export their private keys into a cloud server. Users must deposit funds into a centralized custodial environment, exposing themselves to security vulnerabilities, key leaks, and counterparty risks.
3. **The Privacy Dilemma in Social Trading:** In community group chats, users love to boast about their bets, but sharing on-chain activity currently requires posting a Solana Explorer link or wallet address—doxxing their personal finances and entire transaction history to the public group.
4. **Market Fragmentation & Duplication:** Without intelligent guardrails, multiple community members launch redundant, near-identical markets for the same event, fragmenting liquidity and killing trading depth.

---

## Solution: Explain your proposed Blockchain/Web3-based solution and its unique value.

**PantaChat** solves this by embedding an AI-orchestrated, 100% non-custodial prediction market exchange directly into Telegram, Discord, and a unified WebApp companion powered by the **Panta Protocol on Solana**.

Instead of requiring users to leave their conversations, PantaChat turns everyday chat banter into on-chain liquidity in seconds:

- **Conversational "Reply-to-Market" via AI:** Users simply reply to any message with `/market <topic>` or right-click a message on Discord. Claude 3.5 Sonnet instantly analyzes the context, drafts unambiguous binary resolution criteria, infers cutoff deadlines, and sets categories with zero manual form filling.
- **100% Non-Custodial Solana Architecture:** Users never deposit funds into the bot and never export their private keys. All orders are compiled into Solana `VersionedTransaction` payloads approved with 1 tap via Phantom, Solflare, Backpack, or the integrated Telegram Mini App (TMA).
- **Privacy-Preserving "Brag in Chat":** After locking in a trade, users can voluntarily celebrate in the group with a single click. The bot broadcasts an interactive brag card showing the prediction without exposing the user's raw Solana public key or transaction explorer link. The card features one-tap **"Fade"** buttons, allowing group members to instantly take the opposite side.
- **Creator Royalties & Economy:** Anyone who sparks a market earns an automated percentage of all trading volume generated across the bonding curve, claimable anytime via `/earnings`.
- **Intelligent Deduplication:** Live semantic checks query Supabase to prevent redundant markets, directing traders to existing liquidity pools instead of splitting the community.

---

## Technology Stack: Mention the blockchain/network, protocols, tools, and frameworks used.

### Blockchain & Protocol
- **Solana Network (Devnet & Mainnet-ready):** High-throughput, sub-second transaction finality, and sub-cent execution fees.
- **Panta Protocol (`panta.market`):** Automated primary bonding curve liquidity, dynamic order quoting (`/primaryorderquote/`), trade execution, secondary AMM graduation, and on-chain creator fee distribution.
- **Solana Web3 SDK:** `@solana/web3.js` (v1 & Versioned Transactions), `@solana/spl-token`, `@solana/wallet-adapter-react`.

### Artificial Intelligence
- **Anthropic Claude 3.5 Sonnet (`@anthropic-ai/sdk`):** Structured natural language parsing, resolution rule drafting, deterministic JSON schema validation, and semantic topic categorization.

### Bot Engines & Messaging
- **Telegram Bot & Mini App:** `telegraf` (TypeScript), Telegram WebApp SDK (`TelegramProvider`), inline keyboards, in-place callback query edits.
- **Discord Bot:** `discord.js` (v14), REST Application Slash Commands (`/market`, `/bet`, `/trending`, `/positions`, `/earnings`, `/leaderboard`, `/faucet`), Message Context Menu Commands ("Make a prediction market"), dynamic rich embeds, and interactive button action rows.

### Frontend & Web Companion
- **Next.js 16 (Turbopack, App Router):** Serverless Route Handlers, React 19, Tailwind CSS, Canvas Confetti, and mobile-first responsive viewport layouts.
- **Mobile Wallet Integration:** Deep-linking protocols for Phantom App, Solflare App, and Mobile Wallet Adapter (MWA).

### Backend, Persistence & Tooling
- **Database Layer:** Supabase PostgreSQL (cloud sync, deduplication, historical positions) + SQLite / LibSQL with **Drizzle ORM** for low-latency session caching.
- **Video & Demo Generation:** Remotion (`@remotion/cli`, `@remotion/google-fonts`) for programmatic 1080p demo rendering.
- **Development:** TypeScript 5.7, Node.js v24, `tsx`, `drizzle-kit`.

---

## Inspiration

Crypto culture is driven by conviction, tribalism, and group chat debates. Whether it’s an alpha group on Telegram or a DAO channel on Discord, people spend hours arguing: *"Will SOL hit $300 this month?"*, *"Will the ETF get approved?"*, or *"Will Arsenal beat Chelsea?"*

Yet, sportsbooks and prediction platforms feel sterile, isolated, and detached from where conversations naturally happen. We asked ourselves:

> *What if making a prediction market was as effortless as replying to a tweet or reacting to a message with an emoji? And what if you could trade on it immediately with your existing Solana wallet without giving up your custody or your privacy?*

PantaChat was born to bridge the gap between social banter and on-chain prediction markets.

---

## What it does

1. **AI Market Drafting:** Type `/market Will Bitcoin hit $120k before May?` in Telegram or Discord. The AI drafts the market title, description, resolution criteria, category, and cutoff date in under 3 seconds.
2. **1-Tap Non-Custodial Launch:** The market creator connects their Phantom or Solflare wallet via the web sheet or Telegram Mini App to fund the 50 USDC initial liquidity pool.
3. **Live In-Chat Cards & Sentiment Bars:** The bot posts high-contrast interactive market cards with Unicode progress bars (`YES 70% [🟩🟩🟩🟩🟩🟩🟩🟥🟥🟥] 30% NO`), spot prices, potential multipliers, and preset buy buttons (`[ 🟢 YES $5 ]`, `[ 🔴 NO $20 ]`).
4. **Custom Bet Sizes (`/bet`):** Users can wager any custom amount ($1 to $10,000+) either by typing `/bet <marketId> <yes|no> <amount>` or replying directly to a card.
5. **Market Discovery (`/trending` & `/hot`):** Community members can type `/trending` to see the top 3 highest-volume markets with in-place zero-spam refreshes.
6. **Privacy-Preserving "Brag in Chat":** After confirming an order, users can click `[ 📢 Brag in Chat ]` to send a flex card to the group. Friends can tap `[ Fade NO $5 ]` to take the opposite side with zero wallet doxxing.
7. **Creator Royalties (`/earnings`):** Market creators track accumulated royalties generated from secondary volume and claim their payouts on-chain.
8. **Devnet Testing Faucet (`/faucet`):** Risk-free testing with a built-in 0.25 Devnet SOL faucet protected by 24-hour rate limiting and on-chain verification.

---

## How I built it

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Telegram & Discord Chat Banter                       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Anthropic Claude 3.5 Sonnet AI Drafter                   │
│         Standardizes Title, Verification Criteria & Cutoff Date        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│            Panta Protocol Core Engine & Session Broker                 │
│         Order Quotes • Bonding Curve Math • Supabase Dedup             │
└──────────────────┬───────────────────────────────┬─────────────────────┘
                   │                               │
                   ▼                               ▼
┌──────────────────────────────────┐ ┌───────────────────────────────────┐
│     Next.js WebApp & TMA         │ │     In-Chat Community Cards       │
│  Non-Custodial Phantom/Solflare  │ │  Sentiment Bars • /trending       │
│  Stage 5 Success & Brag Flex UI  │ │  "Fade" Counter-Bets • /earnings  │
└──────────────────────────────────┘ └───────────────────────────────────┘
```

1. **AI Agent Architecture:** Built a structured prompt pipeline with Anthropic Claude 3.5 Sonnet in `src/ai/drafter.ts` that enforces strict JSON schemas, validates resolution determinism, and flags ambiguous questions before on-chain creation.
2. **Session Brokering Engine:** Created an ephemeral state broker (`src/api/panta/`) that generates deterministic trade and creation sessions, caching orders in SQLite and syncing with Supabase for cross-platform state.
3. **Panta Protocol Integration:** Connected to Panta's bonding curve endpoints to fetch live quotes (`getPrimaryOrderQuote`), construct transactions (`buildPrimaryOrderTransaction`), report on-chain fills, and poll for secondary AMM graduation.
4. **Bot Interfaces:**
   - **Telegram:** Built using `telegraf` with support for group chat commands, in-place message edits (`ctx.editMessageText`) to eliminate chat spam, and deep integration with the Telegram Mini App (TMA).
   - **Discord:** Built using `discord.js` v14 with full slash command registration, interactive button components, ephemeral responses, and right-click Message Context Menus.
5. **Next.js Signing Sheet:** Developed a 5-stage stepper in `webapp/src/app/sign/page.tsx` that supports mobile wallet deep links (Phantom, Solflare, MWA), compiles unsigned Versioned Transactions, coordinates wallet signing, and renders the voluntary "Brag in Chat" and "Share on X" actions.

---

## Challenges i ran into

1. **Discord Component URL Limits (`BASE_TYPE_MAX_LENGTH`):**
   - *Problem:* Early versions embedded full AI-generated resolution text and market metadata directly inside query parameters on Discord link buttons. This caused Discord to reject payloads with `components[0].components[0].url: Must be 512 or fewer in length` (400 Bad Request).
   - *Solution:* Re-architected the signing pipeline to use an ephemeral session ID registry (`sess_...`). URLs are now strictly compact (`/sign?session=sess_123`), keeping all button URLs under 70 characters while maintaining rich state on the server.
2. **Non-Custodial UX Inside Chat Clients:**
   - *Problem:* Most Telegram bots take the easy route by acting as custodial wallets (holding users' private keys). Delivering a true non-custodial experience without leaving Telegram was technically demanding.
   - *Solution:* Integrated the Telegram Mini App (TMA) bridge alongside Solana Mobile Wallet Adapter (MWA) and universal app deep-linking protocols (`phantom://`, `solflare://`), ensuring users sign transactions on their terms.
3. **Preventing Chat Spam & Message Noise:**
   - *Problem:* If every odds check or bet created a new message, active group chats would quickly be flooded and bot admins would kick the bot.
   - *Solution:* Engineered all odds refreshes, `/trending` re-queries, and trade confirmations to utilize in-place message updates (`editMessageText` on Telegram, `interaction.update` on Discord) and private ephemeral responses.
4. **Balancing Social Virality with On-Chain Privacy:**
   - *Problem:* Users wanted to boast about winning predictions without publicly associating their personal wealth with their Telegram or Discord usernames.
   - *Solution:* Designed the voluntary "Brag in Chat" feature, which intentionally strips out raw wallet addresses and direct blockchain transaction hashes, displaying only the user's handle, the market title, and dynamic "Fade" counter-bet buttons.

---

## Accomplishments that i'm proud of

- **Zero Custodial Risk:** Built a fully functional social trading bot where the platform **never touches, stores, or requests a user's private keys**.
- **Complete Feature Parity Across 3 Surfaces:** Telegram Bot, Discord Bot, and the Next.js WebApp share the exact same database state, bonding curves, and trade capabilities.
- **Seamless "Reply-to-Market" Workflow:** Users can transform banter into a fully structured prediction market in under 5 seconds with zero manual configuration.
- **Production-Grade Codebase:** Verified across both root and webapp with **0 TypeScript errors (`tsc --noEmit`)**, robust Zod environment validation, and automated test fixtures.
- **Incentive Alignment:** Integrated creator fee collection (`/earnings`) that rewards community leaders for creating markets that drive volume.

---

## What i learnt

- **Solana Transaction Architecture:** Gained deep experience compiling and handling Solana `VersionedTransaction` instances, managing blockhash lifecycles, and orchestrating non-custodial signatures across mobile deep links.
- **Conversational UI Design:** Learned that the best Web3 interfaces are the ones users don't even realize they're using. Hiding complex AMM curves and bonding curve math behind simple `[ YES $5 ]` and `[ Fade NO $20 ]` buttons dramatically lowers the barrier to entry.
- **The Power of Intent-Driven AI:** Using Claude 3.5 Sonnet not as a generic chatbot, but as a deterministic translator between natural language debate and structured financial contracts is a massive unlock for decentralized finance.

---

## What's next for PantaChat

1. **Mainnet Launch on Solana:** Transition from Devnet sandbox testing to live Solana Mainnet with real USDC wagering and high-liquidity market graduation.
2. **AI-Powered Automated Oracle Resolution:** Integrate multi-source LLM consensus and decentralized oracles (Pyth, Switchboard, UMA) to automatically resolve subjective community markets upon cutoff expiry.
3. **Group Chat Tournaments & Syndicate Pools:** Allow entire Telegram groups or Discord guilds to pool funds and compete on a collective prediction leaderboard against rival communities.
4. **Multi-Outcome & Categorical Markets:** Expand beyond binary YES/NO markets to support sports score brackets, election multi-candidate pools, and ranking predictions.
5. **WhatsApp & Farcaster Integration:** Port the conversational engine to Farcaster Frames and WhatsApp Business API to expand distribution to every corner of social crypto.

---

### Project Links & Resources
- **Live WebApp & Explorer:** [https://pantachat.vercel.app](https://pantachat.vercel.app)
- **Telegram Bot:** [@pinkpanta_bot](https://t.me/pinkpanta_bot)
- **GitHub Repository:** [https://github.com/Bobo2005/pantachat](https://github.com/Bobo2005/pantachat)
