"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import { DemoFundsModal } from "@/components/DemoFundsModal";
import { CreateMarketModal } from "@/components/CreateMarketModal";

export function Navbar() {
  const pathname = usePathname();
  const [isFaucetOpen, setIsFaucetOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Auto-open faucet modal if ?faucet=true is in URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("faucet") === "true") {
        setIsFaucetOpen(true);
      }
    }
  }, []);

  const links = [
    { href: "/", label: "Explorer" },
    { href: "/positions", label: "Positions & Claims" },
    { href: "/earnings", label: "Creator Royalties" },
  ];

  return (
    <>
      <header className="h-14 border-b border-[#1e2638] bg-[#0b0e14] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 383 379" className="w-6 h-6 text-white fill-current group-hover:text-[#38bdf8] transition">
                <path fillRule="evenodd" clipRule="evenodd" d="M137.12 234.786C137.636 248.79 138.071 263.025 138.397 277.541C149.641 268.363 160.737 259.447 171.717 250.747C192.849 279.392 212.229 306.97 230.033 333.47C229.988 345.782 230.114 358.339 230.114 370.468C230.114 373.327 230.673 376.393 229.366 378.938C205.979 379.709 185.47 373.14 168.107 365.229C133.509 349.479 108.123 324.358 91.6633 290.234C84.7803 275.966 78.6626 258.69 77.0266 239.813C96.4085 237.939 116.433 236.255 137.12 234.786ZM173.686 277.055C173.841 277.236 174.004 277.411 174.16 277.591C173.454 276.778 172.755 275.953 172.078 275.109L173.686 277.055Z" />
                <path d="M306.402 153.285L306.365 153.454C331.596 152.628 356.924 152.299 382.011 153.454C384.057 159.11 382.394 165.087 381.768 170.4C377.222 208.933 359.316 237.959 337.689 259.597C315.857 281.436 286.051 297.625 247.543 302.939C243.355 303.518 239.047 303.496 234.702 304.124C232.257 280.374 230.102 255.639 228.275 229.877C242.269 229.359 256.493 228.924 271.001 228.599C261.828 217.348 252.92 206.245 244.227 195.261C264.732 180.116 284.685 165.868 304.089 152.456L306.402 153.285Z" />
                <path d="M126.828 79.8864C128.84 100.39 130.649 121.615 132.207 143.586C118.214 144.104 103.988 144.539 89.4815 144.865C98.6538 156.114 107.562 167.218 116.255 178.202C91.9952 196.121 68.4981 212.771 45.777 228.28C36.6353 228.277 27.3931 228.199 18.4546 228.199C12.1952 228.199 5.92392 229.443 0.526473 227.451C-0.581462 221.896 0.291495 216.026 1.02517 210.754C7.73666 162.565 32.9591 130.168 64.2724 106.363C80.9941 93.6618 102.095 84.8746 126.828 79.8864Z" />
                <path fillRule="evenodd" clipRule="evenodd" d="M155.908 0.225714C160.428 -0.554347 168.196 0.87043 173.337 1.72263C211.157 7.98066 238.298 24.6045 260.248 46.5614C272.812 59.1434 283.302 74.3946 290.88 91.4064C296.186 103.327 300.907 116.828 303.011 131.661C277.617 134.341 251.085 136.702 223.363 138.671C222.847 124.668 222.411 110.437 222.085 95.9221C210.841 105.1 199.745 114.011 188.766 122.711C176.469 106.042 164.76 89.7401 153.614 73.799C153.197 54.3683 153.421 29.7452 153.421 8.68951C153.421 4.69095 152.579 0.795815 155.908 0.225714ZM201.009 95.4231C202.7 96.8824 204.344 98.3781 205.958 99.8827L203.502 97.6249C202.682 96.8838 201.851 96.1495 201.009 95.4231Z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-base sm:text-lg tracking-tight text-white">PantaChat</span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Devnet 🟢
            </span>
          </Link>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 font-mono text-xs">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition ${
                    isActive
                      ? "bg-[#181f2c] text-white font-medium border border-[#1e2638]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-2">
          {/* Create Market Button (Desktop) */}
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-xs font-mono font-medium transition cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <span>✨</span>
            <span>Create Market</span>
          </button>

          {/* Demo Funds Faucet Button (Desktop) */}
          <button
            type="button"
            onClick={() => setIsFaucetOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 text-xs font-mono font-medium transition cursor-pointer shadow-sm shadow-sky-500/10"
          >
            <span>💧</span>
            <span>Demo Funds</span>
          </button>

          <a
            href="https://t.me/pantachat_bot"
            target="_blank"
            rel="noreferrer"
            className="hidden lg:flex px-3 py-1.5 rounded-md border border-[#1e2638] hover:border-[#2a344d] text-xs font-mono text-slate-300 hover:text-white transition items-center gap-1.5 bg-[#121721]"
          >
            <span>✈️</span>
            <span>Telegram Bot</span>
          </a>

          <WalletButton />
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Telegram Mini App & Mobile Browsers) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0e121a]/95 backdrop-blur-md border-t border-[#1e2638] h-14 flex items-center justify-around px-2 text-[10px] font-mono">
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 transition ${
            pathname === "/" ? "text-[#38bdf8] font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="text-base leading-none">🧭</span>
          <span>Explorer</span>
        </Link>

        <Link
          href="/positions"
          className={`flex flex-col items-center gap-1 transition ${
            pathname === "/positions" ? "text-[#38bdf8] font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="text-base leading-none">📊</span>
          <span>Positions</span>
        </Link>

        {/* Center Primary Action: Create Market */}
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex flex-col items-center gap-0.5 -mt-3.5 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center text-lg shadow-lg shadow-emerald-500/30 group-active:scale-95 transition">
            ✨
          </div>
          <span className="text-[9px] text-emerald-400 font-semibold">Create</span>
        </button>

        <Link
          href="/earnings"
          className={`flex flex-col items-center gap-1 transition ${
            pathname === "/earnings" ? "text-[#38bdf8] font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="text-base leading-none">💰</span>
          <span>Royalties</span>
        </Link>

        <button
          type="button"
          onClick={() => setIsFaucetOpen(true)}
          className="flex flex-col items-center gap-1 text-sky-400 hover:text-sky-300 transition cursor-pointer"
        >
          <span className="text-base leading-none">💧</span>
          <span>Faucet</span>
        </button>
      </nav>

      {/* Demo Funds Modal */}
      <DemoFundsModal
        isOpen={isFaucetOpen}
        onClose={() => setIsFaucetOpen(false)}
      />

      {/* Create Market Modal with Supabase Deduplication */}
      <CreateMarketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </>
  );
}

export default Navbar;
