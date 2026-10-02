"use client";

import React from "react";

export interface OddsBarProps {
  yesPercent: number; // 0 to 100
  yesPrice?: number;
  noPrice?: number;
  showLabels?: boolean;
  height?: string;
  className?: string;
}

export function OddsBar({
  yesPercent,
  yesPrice,
  noPrice,
  showLabels = true,
  height = "h-3.5",
  className = "",
}: OddsBarProps) {
  const clampedYes = Math.max(2, Math.min(98, Math.round(yesPercent)));
  const clampedNo = 100 - clampedYes;

  return (
    <div className={`w-full ${className}`}>
      {showLabels && (
        <div className="flex items-center justify-between text-xs font-mono font-medium mb-1.5 px-0.5">
          <span className="flex items-center gap-1.5 text-[#10b981]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            <span>YES {clampedYes}%</span>
            {yesPrice !== undefined && (
              <span className="text-slate-400 font-normal">(${yesPrice.toFixed(2)})</span>
            )}
          </span>
          <span className="flex items-center gap-1.5 text-[#ef4444]">
            {noPrice !== undefined && (
              <span className="text-slate-400 font-normal">(${noPrice.toFixed(2)})</span>
            )}
            <span>{clampedNo}% NO</span>
            <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
          </span>
        </div>
      )}

      {/* Split Bar Container */}
      <div
        className={`w-full ${height} bg-[#141a23] rounded-full overflow-hidden flex p-0.5 border border-white/10 shadow-inner`}
      >
        {/* YES Side (Green) */}
        <div
          style={{ width: `${clampedYes}%` }}
          className="h-full bg-gradient-to-r from-[#059669] to-[#10b981] rounded-l-full transition-all duration-500 ease-out relative group"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>

        {/* Divider Gap */}
        <div className="w-0.5 bg-[#0b0e14] h-full"></div>

        {/* NO Side (Red) */}
        <div
          style={{ width: `${clampedNo}%` }}
          className="h-full bg-gradient-to-r from-[#ef4444] to-[#dc2626] rounded-r-full transition-all duration-500 ease-out relative group"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>
    </div>
  );
}

export default OddsBar;
