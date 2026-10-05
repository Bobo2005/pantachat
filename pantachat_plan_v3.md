# PantaChat: Master Build Plan (v4.2 - Production & Everyday Consumer Edition)

**Product Name:** PantaChat  
**Vision:** The everyday conversational prediction layer for Telegram & Discord (built for real long-term consumer use, launched at Colosseum Crypto World's Fair + Panta Sidetrack)  
**Target:** **1st Place ($2,000 USDG) + Long-Term Production App**  
**Plan Date:** October 2, 2026 (Updated October 5, 2026)  
**Environment Mode:** **Staging / Devnet for Hackathon $\to$ 1-Line Switch to Mainnet for Public Launch**

---

## Executive Summary: Beyond a Hackathon Project

Most hackathon entries are disposable prototypes that die after judging. **PantaChat is architected as a real, scalable, everyday consumer product.**

Colosseum and Panta explicitly evaluate **"Impact Potential: Real-world use beyond the hackathon."** By building production-grade UI, multi-tenant group support, and non-custodial wallet UX, PantaChat delivers an everyday experience that communities will continue to use daily to settle friendly debates, wager on sports, and monetize alpha.

---

## 1. The 3 Complete UI Surfaces

PantaChat is not just a text bot; it features **three integrated UI surfaces**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PANTACHAT UI ECOSYSTEM                          │
├─────────────────────────┬───────────────────────┬──────────────────────┤
│ 1. IN-CHAT UI           │ 2. TELEGRAM MINI APP  │ 3. WEB COMPANION APP │
│ (Telegram & Discord)    │ (In-Chat Mobile Modal)│ (Desktop / Mobile)   │
├─────────────────────────┼───────────────────────┼──────────────────────┤
│ • Interactive Cards     │ • 1-Tap Wallet Auth   │ • Global Discovery   │
│ • Sentiment Odds Bars   │ • Order Review Sheet  │ • Portfolio Tracker  │
│ • Preset Quick Buttons  │ • 5-State Stepper     │ • Creator Royalties  │
│ • In-Place Odds Refresh │ • Slippage Settings   │ • Server Leaderboard │
└─────────────────────────┴───────────────────────┴──────────────────────┘
```

### Surface 1: In-Chat Interactive Card (Telegram & Discord)
* **Visual Sentiment Progress Bar:**
  ```text
  ⚽ Champions League: Arsenal vs Real Madrid
  "Will Arsenal qualify for the semi-finals?"
  
  YES 64%  [🟩🟩🟩🟩🟩🟩🟩🟥🟥🟥🟥]  36% NO
  Est. Win Return: 1.56x on YES | 2.78x on NO (Mark-to-Market: $0.64 / $0.36)
  Volume: $4,850 USDC • 38 Traders • Closes in 4h
  
  [ YES $5 ] [ YES $20 ] [ NO $5 ] [ NO $20 ]
  [ ⚙️ Custom ] [ 🔄 Refresh Odds ] [ 📊 Details ]
  ```
* **In-Place Updates:** Tapping `🔄 Refresh` updates odds and progress bars via `ctx.editMessageText()` / `interaction.update()` without spamming the chat with new messages.
* **Secondary Market State:** If a market has already graduated (`phase: secondary`), bonding curve buying is closed. The card replaces buy buttons with `[ 🌐 Trade on Panta Secondary ]` pointing directly to `https://panta.market/market/{id}`.
* **Discord Rich Embeds:** Includes custom hex color bars (Green for Live Primary, Blue for Graduated Secondary, Purple for Resolved).

### Surface 2: Telegram Mini App (TMA) / Native Mobile Signing Sheet
* Built with **Next.js, Tailwind CSS, and `@solana/wallet-adapter-react`**.
* **Zero Browser Bouncing & Fallback:** On mobile Telegram, tapping any action button opens a sleek bottom-sheet modal natively inside Telegram (`web_app: { url }`).
* **Resilient Wallet Fallback:** Includes a 1-tap "Open in External Browser" fallback link if the mobile Telegram webview restricts Phantom/Solflare deep-linking.
* **5-State Visual Stepper:**
  ```text
  [1. Quote] ─── [2. Build] ─── [3. Approve] ─── [4. Confirm]
  ```

---

## 2. Core Architecture Innovations (Completed)

1. **Supabase Market Deduplication:**
   - Real-time question normalization and database checks prevent identical prediction markets from being duplicated across WebApp, Telegram, or Discord.
2. **Soft Archiving (Past / History Lifecycle):**
   - Automatically migrates resolved markets into the Past / History feed while keeping player positions and winnings claimable forever.
3. **Frictionless Demo Funds Faucet:**
   - Instant Devnet SOL transfers directly to user addresses with 24h rate limiting and cross-bot confirmation alerts. No third-party OAuth or GitHub linkage required.
4. **Universal Responsive UX:**
   - Complete responsive layout across Desktop, Tablet, and Mobile / Telegram Mini App with a fixed bottom navigation bar, card-based mobile positions, and stabilized viewports.

---

## 3. Demo Video Storyboard

| Timestamp | Screen Action | Voiceover / Text Overlay | Rubric Hit |
|---|---|---|---|
| **0:00–0:15** | Telegram group chat debate. | *"Prediction markets shouldn't be destinations you visit alone. They should live inside the conversations where debates actually happen."* | Problem statement & Core thesis |
| **0:15–0:35** | User replies `/create`. Bot AI drafts standardized rules. Supabase checks deduplication. Creator confirms on Devnet. | *"Meet PantaChat. With one reply, Claude drafts market rules, deduplicates questions, and signs on Solana Devnet."* | Reply-to-Create Moat + Panta Creation API |
| **0:35–0:55** | Live card appears in chat. User buys YES with 1-tap Devnet funds. Odds shift dynamically. | *"The group trades directly from the card with automated bonding curves."* | Buy Flow + UX + Attribution |
| **0:55–1:15** | Market resolves $\to$ moves to Past / History feed. Winner claims payout. Creator claims royalties. | *"Full lifecycle: soft archiving, instant payout claims, and creator royalties."* | Full Lifecycle Moat |
| **1:15–1:40** | Responsive WebApp & TMA walk-through. | *"Seamless across Desktop, Mobile Web, and Telegram Mini Apps."* | Multi-Surface Execution |
| **1:40–2:00** | Live traction stats, open source repo, and closing slide. | *"PantaChat: Bringing prediction markets into the conversation. Powered by Panta."* | Polish & Impact |

---

## 4. Hackathon Submission Checklist

- [x] Registered for official Colosseum Crypto World's Fair hackathon
- [x] Registered for Panta API Sidetrack on Superteam Earn
- [x] "Powered by Panta" clearly visible on card footer and signing page
- [x] Working Demo on Devnet + Frictionless `/faucet` mode for judges
- [x] Supabase deduplication & soft-archiving active
- [x] Universal responsive UI across Desktop, Mobile, and TMA
- [x] Codebase sanitized of all secrets & API keys
- [ ] Record 2-minute demo video following storyboard
- [ ] Push to GitHub & deploy on Vercel/Render
- [ ] Dual submission confirmed on both platforms before deadline
