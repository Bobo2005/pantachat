/**
 * Utilities for Mobile Solana Wallet Integration & Universal Deep Linking
 * Enables frictionless 1-tap Phantom & Solflare connection on Android & iOS
 * without getting blocked by WebView Mobile Wallet Adapter (MWA) intent issues.
 */

export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

export function isPhantomInjected(): boolean {
  if (typeof window === "undefined") return false;
  const anyWin = window as any;
  return Boolean(anyWin?.phantom?.solana?.isPhantom || anyWin?.solana?.isPhantom);
}

/**
 * Launches the exact current web companion or signing sheet inside Phantom's
 * built-in Web3 browser where Phantom wallet is natively injected and authenticated.
 */
export function openInPhantomApp(targetUrl?: string): void {
  if (typeof window === "undefined") return;
  const urlToOpen = targetUrl || window.location.href;
  const origin = window.location.origin;
  const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(urlToOpen)}?ref=${encodeURIComponent(origin)}`;
  window.location.href = deepLink;
}

/**
 * Launches the exact current page inside Solflare's in-app browser.
 */
export function openInSolflareApp(targetUrl?: string): void {
  if (typeof window === "undefined") return;
  const urlToOpen = targetUrl || window.location.href;
  const deepLink = `https://solflare.com/ul/v1/browse/${encodeURIComponent(urlToOpen)}`;
  window.location.href = deepLink;
}
