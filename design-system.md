# PantaChat: UI Design System & Component Guidelines
**Theme:** Futuristic Solana Dark Mode / Glassmorphism / Cyber-Financial  
**Audience:** Everyday Telegram & Discord power users, crypto natives, and prediction traders  
**Goal:** Slick, responsive, wow-factor visual aesthetics built for Top 1 hackathon evaluation and long-term consumer retention.

---

## 1. Color Palette

```
┌────────────────────────────────────────────────────────────────────────┐
│                              COLOR TOKENS                              │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ ROLE              │ HEX / HSL         │ USAGE                          │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ Background Canvas │ #0B0E14           │ App dark canvas                │
│ Card Surface      │ #141A23           │ Elevated cards, group cards    │
│ Glass Accent      │ rgba(20,26,35,0.7)│ Modals, Mini App sheets        │
│ Border Highlight  │ #232D3F           │ Subtle borders & dividers      │
│ Solana Green      │ #10B981 / #00FFA3 │ YES sentiment, Success, Live   │
│ Vibrant Rose      │ #EF4444 / #FF3B30 │ NO sentiment, Expirations      │
│ Electric Purple   │ #8B5CF6 / #9945FF │ Solana branding, Secondary Mkt │
│ Cyan Glow         │ #06B6D4 / #14F195 │ Creator Royalties, Accent      │
│ Text Primary      │ #F8FAFC           │ Headlines, odds percentages    │
│ Text Muted        │ #94A3B8           │ Volume, countdown, rules       │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### CSS Variables (`webapp/src/app/globals.css`)
```css
:root {
  --bg-primary: #0b0e14;
  --bg-surface: #141a23;
  --bg-surface-elevated: #1a2332;
  --bg-glass: rgba(20, 26, 35, 0.75);
  
  --border-subtle: #232d3f;
  --border-focus: #3b82f6;

  /* Outcome Colors */
  --yes-primary: #10b981;
  --yes-glow: rgba(16, 185, 129, 0.25);
  --no-primary: #ef4444;
  --no-glow: rgba(239, 68, 68, 0.25);

  /* Solana Accents */
  --solana-purple: #9945ff;
  --solana-cyan: #14f195;
  --solana-gradient: linear-gradient(135deg, #9945ff 0%, #14f195 100%);
  
  --text-main: #f8fafc;
  --text-dim: #94a3b8;
  --text-highlight: #ffffff;
}
```

---

## 2. Typography

* **Headlines:** `Outfit`, sans-serif (Punchy, modern, geometric).
* **Body & UI Elements:** `Inter`, sans-serif (Optimized for micro-copy and dense numbers).
* **Financial & Odds Data:** `JetBrains Mono`, monospace (Tabular figures prevent jitter during live odds reloads).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
```

---

## 3. Surface 1: In-Chat Visual Card Layout

### Telegram Formatting (MarkdownV2 + Emoji Odds Bar)
```text
🔥 *CRYPTO PREDICTION MARKET*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Will Solana flip Ethereum in market cap before 2027?*

📊 *Current Sentiment:*
🟢 YES 68%  `[🟩🟩🟩🟩🟩🟩🟩🟥🟥🟥]`  32% NO 🔴

💰 *Est. Win Multipliers (Mark-to-Market):*
• YES: *1.47x* (Spot: $0.68)
• NO:  *3.12x* (Spot: $0.32)

📈 *Market Stats:*
Volume: *$12,450 USDC* • Traders: *42* • Ends: *28d 14h*
Creator: `@solana_alpha` • Status: *Primary Curve 🟢*
Mode: *🧪 Demo Sandbox (Devnet)*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ 🟢 Buy YES $5 ]  [ 🟢 Buy YES $20 ]
[ 🔴 Buy NO $5  ]  [ 🔴 Buy NO $20  ]
[ ⚙️ Custom Amount ] [ 🔄 Refresh Odds ]
[ 💧 Get Demo Funds ] [ ⚡ Powered by Panta ]
```

### Discord Rich Embed Format
* **Color Code:**
  * `#10B981` (Green) for **Primary Bonding Curve**
  * `#9945FF` (Purple) for **Graduated Secondary Market**
  * `#64748B` (Slate) for **Resolved / Awaiting Claims**
* **Thumbnail:** Market category icon or AI-generated thumbnail.
* **Fields:**
  * `Sentiment`: Monospace text bar `[■■■■■■■□□□] 70% vs 30%`
  * `Estimated Payout`: `$1.43 / $3.33`
  * `Volume & Liquidity`: `$8,200 USDC`
  * `Resolution Date`: Relative Discord timestamp `<t:1791234567:R>`

---

## 4. Surface 2: Telegram Mini App & Signing Sheet (Next.js)

### Glassmorphism Card Style
```css
.glass-panel {
  background: rgba(20, 26, 35, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  border-radius: 1.25rem;
}
```

### 5-State Visual Progress Stepper
Each signing action displays an animated stepper:
1. **Quote Received:** Green pulse indicator with 90s countdown ring.
2. **Tx Assembled:** Shows exact breakdown of Shares, USDC cost, Max Slippage (3%), and Fee.
3. **Approve in Wallet:** Pulsing Phantom / Solflare ghost icon prompting wallet confirmation.
4. **Devnet Confirmation:** Live animated spinner tracking Solana RPC confirmation.
5. **Success Celebration:** Confetti micro-animation + direct link to Solana Explorer.

### Micro-Animations
* **Button Hover:** `transform: translateY(-2px); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);`
* **Odds Change Flash:** When odds refresh, the changed value flashes green (increase) or red (decrease) for 400ms.
* **TMA Bottom Sheet Slide:** Native iOS/Android cubic-bezier slide-up animation (`cubic-bezier(0.16, 1, 0.3, 1)`).

---

## 5. Surface 3: Web Companion Portal

* **Sticky Navigation Bar:** Frosted glass header with wallet status, cluster pill (`Devnet 🟢`), and quick links (`/markets`, `/positions`, `/earnings`, `/leaderboard`).
* **Interactive Odds Slider:** Allows dragging investment amount ($5 to $500) to see live projected share payout and ROI before connecting a wallet.
* **Creator Royalties Vault:** Card showing accumulated 20% protocol fees for markets created by the user, with an interactive graduation progress bar and a glowing `[ Claim Creator Royalty ]` button.

---

## 6. Accessibility & Clean UX Rules

1. **Monospace Tabular Figures:** Always use `font-mono tabular-nums` for prices, timestamps, and USDC values to eliminate layout shift.
2. **Touch Targets:** Minimum 48px touch height for all inline and webapp buttons.
3. **Contrast Ratio:** Minimum 4.5:1 text-to-background contrast on all card surfaces.
4. **Clear Error States:** Friendly human explanations for transaction failures (e.g. *"Transaction cancelled in wallet"*, *"Slippage exceeded — tapped to re-quote"*, *"Devnet airdrop requested"*).
