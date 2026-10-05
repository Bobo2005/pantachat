"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  "Crypto",
  "Sports",
  "Stocks",
  "Macroeconomics",
  "Politics",
  "Pop Culture",
];

function normalizeTitle(str: string): string {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:'"“”’]+$/g, "")
    .replace(/\s+/g, " ");
}

export function CreateMarketModal({ isOpen, onClose }: CreateMarketModalProps) {
  const { connected, publicKey } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Crypto");
  const [description, setDescription] = useState("");
  const [cutoffDate, setCutoffDate] = useState(() => {
    // Default to 14 days from now
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  });

  const [isChecking, setIsChecking] = useState(false);
  const [existingMarketList, setExistingMarketList] = useState<any[]>([]);
  const [duplicateMarket, setDuplicateMarket] = useState<any | null>(null);

  // Load existing markets from Supabase / API when modal opens
  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/markets")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data?.markets)
          ? data.markets
          : Array.isArray(data)
          ? data
          : [];
        setExistingMarketList(list);
      })
      .catch((err) => {
        console.warn("[CreateMarketModal] Could not fetch markets for duplicate check:", err);
      });
  }, [isOpen]);

  // Real-time Supabase Duplicate Market Checking with 250ms debounce
  useEffect(() => {
    const trimmed = title.trim();
    if (trimmed.length < 5) {
      setDuplicateMarket(null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(() => {
      const normalizedTarget = normalizeTitle(trimmed);
      const match = existingMarketList.find(
        (m: any) => m.title && normalizeTitle(m.title) === normalizedTarget
      );

      setDuplicateMarket(match || null);
      setIsChecking(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [title, existingMarketList]);

  if (!isOpen) return null;

  const isFormValid =
    title.trim().length >= 10 &&
    !duplicateMarket &&
    !isChecking &&
    Boolean(cutoffDate);

  const handleLaunch = () => {
    if (!connected) {
      setWalletModalVisible(true);
      return;
    }

    if (duplicateMarket || !isFormValid) return;

    const sessionId = `sess_create_${Date.now()}`;
    const query = new URLSearchParams({
      session: sessionId,
      type: "create",
      title: title.trim(),
      category,
      desc: description.trim() || `Market resolves based on official outcome: ${title.trim()}`,
      cutoff: new Date(`${cutoffDate}T23:59:59.000Z`).toISOString(),
      creator: publicKey ? publicKey.toBase58() : "anonymous",
    });

    onClose();
    window.location.href = `/sign?${query.toString()}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#121721] border border-[#1e2638] rounded-xl shadow-2xl p-4 sm:p-6 text-white relative flex flex-col gap-4 font-sans max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
              ✨
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-white">Create Prediction Market</h2>
              <p className="text-[11px] font-mono text-slate-400">
                Launch a verified Solana Devnet market with Supabase deduplication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-[#181f2c] border border-[#1e2638] text-slate-400 hover:text-white flex items-center justify-center text-xs transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="flex flex-col gap-4">
          {/* Market Title / Question */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="create-market-title" className="font-medium text-slate-200">
                Market Question <span className="text-rose-400">*</span>
              </label>
              {isChecking && (
                <span className="text-[10px] font-mono text-sky-400 animate-pulse">
                  Checking Supabase...
                </span>
              )}
            </div>
            <textarea
              id="create-market-title"
              rows={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Will Bitcoin reach $150,000 before December 31, 2026?"
              className={`w-full bg-[#0b0e14] border ${
                duplicateMarket
                  ? "border-amber-500/80 focus:border-amber-400"
                  : title.trim().length >= 10 && !isChecking
                  ? "border-emerald-500/50 focus:border-emerald-400"
                  : "border-[#1e2638] focus:border-[#38bdf8]"
              } rounded-lg p-2.5 text-xs text-white placeholder-slate-500 outline-none transition font-sans resize-none`}
            />

            {/* Live Supabase Duplicate Guard Alert */}
            {duplicateMarket ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2 font-sans animate-in fade-in duration-200">
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-amber-300">
                      Market Already Exists on Supabase!
                    </span>
                    <span className="text-[11px] text-amber-200/90 leading-tight">
                      A prediction market for this question was already created:
                    </span>
                    <span className="font-medium text-white text-[11px] italic bg-black/40 px-2 py-1 rounded border border-amber-500/20">
                      &quot;{duplicateMarket.title}&quot;
                    </span>
                    <span className="text-[10px] text-amber-300/80 mt-0.5">
                      To keep all liquidity unified, duplicate questions cannot be created.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                  <a
                    href={`/?market=${duplicateMarket.id}`}
                    onClick={onClose}
                    className="flex-1 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-black font-semibold text-center text-xs font-mono transition cursor-pointer"
                  >
                    📈 Trade Existing Market Instead
                  </a>
                </div>
              </div>
            ) : title.trim().length >= 10 && !isChecking ? (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                ✓ Unique question! Verified available on Supabase.
              </span>
            ) : null}
          </div>

          {/* Category & Resolution Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-market-category" className="text-xs font-medium text-slate-200">Category</label>
              <select
                id="create-market-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#38bdf8] transition font-mono cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Cutoff / End Date */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-market-cutoff" className="text-xs font-medium text-slate-200">Trading Ends</label>
              <input
                id="create-market-cutoff"
                type="date"
                value={cutoffDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setCutoffDate(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#38bdf8] transition font-mono"
              />
            </div>
          </div>

          {/* Resolution Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-market-description" className="text-xs font-medium text-slate-200">
              Resolution Criteria <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="create-market-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Resolves YES if CoinGecko spot price >= $150,000 USD."
              className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-lg p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[#38bdf8] transition font-sans"
            />
          </div>

          {/* Creation Terms Summary Card */}
          <div className="p-3 rounded-lg bg-[#0b0e14] border border-[#1e2638] flex flex-col gap-1.5 text-xs font-mono text-slate-400">
            <div className="flex justify-between items-center">
              <span>Creation Deposit:</span>
              <span className="text-emerald-400 font-bold">50 Devnet USDC</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Creator Royalty:</span>
              <span className="text-cyan-400 font-medium">0.50% volume royalty</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Deduplication Policy:</span>
              <span className="text-slate-300">Checked against Supabase</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#1e2638]">
          <button
            type="button"
            disabled={!isFormValid || Boolean(duplicateMarket)}
            onClick={handleLaunch}
            className={`w-full py-2.5 rounded-lg text-xs font-semibold font-mono transition flex items-center justify-center gap-2 shadow-lg ${
              duplicateMarket
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
                : !isFormValid
                ? "bg-slate-800 text-slate-400 border border-[#1e2638] cursor-not-allowed opacity-75"
                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 cursor-pointer"
            }`}
          >
            {duplicateMarket
              ? "🚫 Market Already Exists (Duplicate Blocked)"
              : !connected
              ? "Connect Wallet to Launch"
              : "🚀 Proceed to Launch Market (50 USDC)"}
          </button>

          <p className="text-[10px] text-center text-slate-500 font-mono">
            All markets are checked against Supabase cloud records to prevent duplicate listings.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CreateMarketModal;
