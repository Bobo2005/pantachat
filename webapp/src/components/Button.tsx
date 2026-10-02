import React from "react";

export type ButtonVariant = "primary" | "yes" | "no" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[#9945ff] to-[#14f195] text-white font-semibold hover:shadow-[0_0_24px_rgba(153,69,255,0.45)] border border-white/20",
  yes:
    "bg-gradient-to-r from-[#059669] to-[#10b981] text-white font-semibold hover:shadow-[0_0_20px_rgba(16,185,129,0.45)] border border-[#10b981]/40",
  no:
    "bg-gradient-to-r from-[#dc2626] to-[#ef4444] text-white font-semibold hover:shadow-[0_0_20px_rgba(239,68,68,0.45)] border border-[#ef4444]/40",
  secondary:
    "bg-[#141a23]/80 hover:bg-[#1a2332] text-slate-200 border border-white/10 hover:border-white/25",
  ghost:
    "bg-transparent hover:bg-white/5 text-slate-400 hover:text-white border border-transparent",
  danger:
    "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50",
};

export function Button({
  variant = "primary",
  loading = false,
  icon,
  children,
  fullWidth = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const baseClass =
    "relative inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer";
  const styling = variantClasses[variant] || variantClasses.primary;
  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClass} ${styling} ${widthClass} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

export default Button;
