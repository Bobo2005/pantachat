import React from "react";

export type BadgeVariant =
  | "devnet"
  | "primary"
  | "secondary"
  | "resolved"
  | "won"
  | "lost"
  | "warning";

export interface BadgeProps {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string; defaultLabel: string }> = {
  devnet: {
    bg: "bg-[#10b981]/10",
    text: "text-[#10b981]",
    border: "border-[#10b981]/30",
    dotColor: "bg-[#10b981]",
    defaultLabel: "Devnet 🟢",
  },
  primary: {
    bg: "bg-[#10b981]/10",
    text: "text-[#10b981]",
    border: "border-[#10b981]/30",
    dotColor: "bg-[#10b981]",
    defaultLabel: "Primary Curve",
  },
  secondary: {
    bg: "bg-[#9945ff]/10",
    text: "text-[#9945ff]",
    border: "border-[#9945ff]/30",
    dotColor: "bg-[#9945ff]",
    defaultLabel: "Graduated Secondary",
  },
  resolved: {
    bg: "bg-slate-700/20",
    text: "text-slate-400",
    border: "border-slate-600/30",
    dotColor: "bg-slate-400",
    defaultLabel: "Resolved",
  },
  won: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
    dotColor: "bg-emerald-400",
    defaultLabel: "🏆 Won",
  },
  lost: {
    bg: "bg-rose-500/15",
    text: "text-rose-400",
    border: "border-rose-500/40",
    dotColor: "bg-rose-400",
    defaultLabel: "Lost",
  },
  warning: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/40",
    dotColor: "bg-amber-400",
    defaultLabel: "Notice",
  },
};

export function Badge({
  variant = "primary",
  children,
  className = "",
  dot = true,
}: BadgeProps) {
  const config = variantStyles[variant] || variantStyles.primary;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${variant === "devnet" || variant === "primary" ? "animate-pulse" : ""}`}
        />
      )}
      <span>{children || config.defaultLabel}</span>
    </span>
  );
}

export default Badge;
