# PantaChat WebApp & Telegram Mini App Companion 🌐⚡

> **Next.js 16 WebApp, Signing Portal, and Telegram Mini App for PantaChat**

The PantaChat WebApp provides non-custodial transaction signing, real-time prediction market exploration, positions management, and creator royalty tracking across Desktop browsers, Mobile Web, and inside Telegram as a Telegram Mini App (TMA).

---

## 🚀 Key Pages & Architecture

### 1. Market Explorer (`/`)
- **Active & History Tabs**: Real-time prediction markets powered by Panta Protocol bonding curves. Resolved markets automatically move to the **Past / History** tab via the Soft Archiving architecture.
- **Horizontal Category Pills**: Fluid touch-scrolling filter chips (All, Crypto, Tech, Sports, Politics, Culture) on mobile.
- **Quick-Buy Modal Sheet**: Responsive slide-up modal with presets ($5, $20, $50, $100), dynamic odds calculations, and fee breakdown.

### 2. Positions & Claims (`/positions`)
- **Multi-Screen Responsive Layout**:
  - **Desktop**: Full data table with market, outcome, shares, cost, value, PnL, and claim status.
  - **Mobile / Telegram Mini App**: Native mobile cards with prominent 🟢 YES / 🟣 NO badges, payout summaries, and full-width `💰 Claim Winnings` buttons.
- Connects directly to user wallet to fetch open bets and resolved market payouts.

### 3. Creator Royalties & Earnings (`/earnings`)
- Real-time tracking of fees earned by users who launched prediction markets.
- Summary stat cards (`Total Volume`, `Graduated Markets`, `Claimable Royalties`) with responsive 1-column mobile / 3-column desktop grid.

### 4. Non-Custodial Signer Portal (`/sign?session=<id>`)
- Deep-linked from Telegram Bot and Discord Bot when users trade in chat.
- **5-State Visual Stepper**: `Quote` $\to$ `Build` $\to$ `Sign` $\to$ `Broadcast` $\to$ `Confirmed`.
- Compiles Panta Protocol instructions into a Solana `VersionedTransaction` and signs using the connected wallet.

### 5. Demo Funds Faucet Modal
- **Zero Friction**: Request Devnet SOL directly to any connected wallet without requiring third-party OAuth or GitHub linkage.
- **Rate-Limiting**: Enforces a 24-hour cooldown per wallet address.
- **Cross-Platform Alerts**: Dispatches confirmation notifications to Telegram and Discord with Solscan transaction links.

---

## 📱 Mobile & Telegram Mini App (TMA) Optimizations

- **Responsive Viewport Configuration** (`layout.tsx`):
  ```ts
  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  };
  ```
- **Mobile Bottom Navigation Bar** (`Navbar.tsx`):
  Fixed bottom navigation bar on screens `< 768px` featuring thumb access to **Explorer**, **Positions**, center **✨ Create**, **Royalties**, and **💧 Faucet**.
- **Telegram WebApp SDK Integration** (`TelegramProvider.tsx`):
  - Detects native Telegram environment via `window.Telegram.WebApp`.
  - Automatically triggers `tg.expand()` for a full-sheet view.
  - Provides an "Open in Safari / Chrome" fallback banner for mobile Phantom/Solflare deep-linking if the Telegram webview restricts external wallet connections.

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables (`.env.local`)
Create `.env.local` in `webapp/`:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Panta API
PANTA_API_BASE_URL=https://staging-api.panta.market/api/v1
PANTA_API_KEY=pk_test_...

# Faucet Dispenser (Devnet SOL transfer)
FAUCET_PRIVATE_KEY=...
```

### 3. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
```

---

## 🌐 Deployment on Vercel

1. Push code to GitHub.
2. Import project in [Vercel](https://vercel.com) selecting `webapp` as the Root Directory.
3. Configure Environment Variables matching `.env.local`.
4. Deploy!
