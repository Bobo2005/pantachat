"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/WalletButton";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Explorer" },
    { href: "/positions", label: "Positions & Claims" },
    { href: "/earnings", label: "Creator Royalties" },
  ];

  return (
    <header className="h-14 border-b border-[#1e2638] bg-[#0b0e14] px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current group-hover:text-[#38bdf8] transition">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2zm6 8h-2v-4h2v4zm0-6h-2V7h2v4z" />
            </svg>
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-white">PantaChat</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Devnet 🟢
          </span>
        </Link>

        {/* Navigation Tabs */}
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
      <div className="flex items-center gap-3">
        <a
          href="https://t.me/pantachat_bot"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex px-3 py-1.5 rounded-md border border-[#1e2638] hover:border-[#2a344d] text-xs font-mono text-slate-300 hover:text-white transition items-center gap-1.5 bg-[#121721]"
        >
          <span>✈️</span>
          <span>Open Telegram Bot</span>
        </a>
        <WalletButton />
      </div>
    </header>
  );
}

export default Navbar;
