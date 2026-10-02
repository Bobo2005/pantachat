"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramContextType {
  isTelegram: boolean;
  user: TelegramUser | null;
  initData: string;
  expand: () => void;
  close: () => void;
  openExternalBrowser: (url: string) => void;
}

const TelegramContext = createContext<TelegramContextType>({
  isTelegram: false,
  user: null,
  initData: "",
  expand: () => {},
  close: () => {},
  openExternalBrowser: () => {},
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegram(true);
      setInitData(tg.initData);

      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      }

      // Notify Telegram that the Mini App is ready and expand to full sheet height
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.("#0b0e14");
        tg.setBackgroundColor?.("#0b0e14");
      } catch (err) {
        console.warn("[TMA] Failed expanding Telegram WebApp:", err);
      }
    }
  }, []);

  const expand = () => {
    if (typeof window !== "undefined") {
      (window as any).Telegram?.WebApp?.expand?.();
    }
  };

  const close = () => {
    if (typeof window !== "undefined") {
      (window as any).Telegram?.WebApp?.close?.();
    }
  };

  const openExternalBrowser = (url: string) => {
    if (typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    }
  };

  return (
    <TelegramContext.Provider
      value={{
        isTelegram,
        user,
        initData,
        expand,
        close,
        openExternalBrowser,
      }}
    >
      {/* 1-tap External Browser fallback banner for mobile Phantom deep-linking */}
      {isTelegram && (
        <div className="bg-[#121721] border-b border-[#1e2638] px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Telegram Mini App</span>
          </span>
          <button
            onClick={() => openExternalBrowser(window.location.href)}
            className="text-[#38bdf8] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Open in Safari / Chrome ↗</span>
          </button>
        </div>
      )}
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}

export default TelegramProvider;
