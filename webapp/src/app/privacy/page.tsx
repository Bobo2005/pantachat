import React from "react";
import Navbar from "@/components/Navbar";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex flex-col justify-between font-sans selection:bg-[#38bdf8]/20 selection:text-white pb-12">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-5 py-10 flex flex-col gap-8">
        <div className="border-b border-[#1e2638] pb-5">
          <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Legal & Compliance
          </span>
          <h1 className="font-heading font-bold text-3xl text-white mt-2">Privacy Policy</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Last Updated: October 2026 • Non-Custodial Prediction Protocol
          </p>
        </div>

        <section className="flex flex-col gap-6 text-sm text-slate-300 leading-relaxed font-sans">
          <div>
            <h2 className="text-base font-semibold text-white mb-2 font-heading">1. Introduction</h2>
            <p>
              PantaChat (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) is a decentralized, non-custodial conversational prediction market interface accessible via Telegram, Discord, and Web. We prioritize user privacy and self-sovereignty. Because our architecture is non-custodial, we never hold, store, or manage your private keys, seed phrases, or cryptocurrency assets.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2 font-heading">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">Public Blockchain Data:</strong> Your public Solana wallet address, on-chain transaction signatures, and interaction history with Panta Protocol smart contracts.
              </li>
              <li>
                <strong className="text-slate-200">Chat Platform Identifiers:</strong> Your public Telegram user ID or Discord user ID, used exclusively to correlate session routing, ephemeral notifications, and attribution for creator royalties.
              </li>
              <li>
                <strong className="text-slate-200">Prediction Market Queries:</strong> Text prompts and replies submitted when initiating market creation with <code className="text-[#38bdf8]">/market</code>, processed in real-time to extract resolution parameters.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2 font-heading">3. Information We Do NOT Collect</h2>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400">
              <li>We never collect or store private keys, recovery phrases, or wallet passwords.</li>
              <li>We never record, scrape, or store unrelated private messages, chat logs, or personal conversation history from your Telegram groups or Discord guilds.</li>
              <li>We do not sell, rent, or monetize personal user data to third-party data brokers or advertisers.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2 font-heading">4. How Information Is Used</h2>
            <p className="text-slate-400">
              Collected technical data is strictly utilized to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400 mt-2">
              <li>Coordinate non-custodial transaction signing requests between chat interfaces and Solana wallets.</li>
              <li>Calculate creator fee royalties and display portfolio leaderboards.</li>
              <li>Trigger automated alerts when prediction markets resolve so winners can claim rewards.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2 font-heading">5. Blockchain Transparency & Security</h2>
            <p>
              All orders, token balances, and outcome claims settle transparently on the Solana blockchain. Once a transaction is broadcast, it becomes part of the permanent public ledger and cannot be altered or removed by PantaChat.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-white mb-2 font-heading">6. Contact & Inquiries</h2>
            <p className="text-slate-400">
              For questions regarding this Privacy Policy or protocol verification, please reach out via our community channels or repository documentation.
            </p>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-[#1e2638] py-4 text-center text-xs font-mono text-slate-500">
        PantaChat • Built with Panta Protocol on Solana Devnet
      </footer>
    </div>
  );
}
