/**
 * Centralized USDC and probability unit formatting helpers.
 * Handles normalization between Panta 6-decimal integer base units and human decimal strings.
 */

/**
 * Converts human USDC (e.g., "20.00" or 20) to 6-decimal integer base units (e.g., 20000000).
 */
export function toBaseUnits(amount: string | number): number {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numericAmount) || numericAmount < 0) {
    throw new Error(`Invalid USDC amount: ${amount}`);
  }
  return Math.round(numericAmount * 1_000_000);
}

/**
 * Converts 6-decimal integer base units (e.g., 20000000) to human decimal string (e.g., "20.00").
 */
export function fromBaseUnits(baseUnits: number | string): string {
  const numericUnits = typeof baseUnits === "string" ? parseInt(baseUnits, 10) : baseUnits;
  if (isNaN(numericUnits) || numericUnits < 0) {
    throw new Error(`Invalid base units: ${baseUnits}`);
  }
  return (numericUnits / 1_000_000).toFixed(2);
}

/**
 * Formats a numeric USDC amount as a currency string (e.g., 20 -> "$20.00").
 */
export function formatUsdc(amount: number): string {
  if (isNaN(amount)) {
    return "$0.00";
  }
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a probability ratio (0.0 to 1.0) as a percentage string (e.g., 0.68 -> "68%").
 */
export function formatPercentage(prob: number): string {
  if (isNaN(prob)) {
    return "0%";
  }
  const percentage = Math.round(prob * 100);
  return `${Math.max(0, Math.min(100, percentage))}%`;
}

// Memory.md invariant convenience aliases
export const parseUsdc = toBaseUnits;
