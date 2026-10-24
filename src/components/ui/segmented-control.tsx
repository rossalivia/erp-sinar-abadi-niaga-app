"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  size?: "sm" | "md";
  layoutIdPrefix?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "md",
  layoutIdPrefix = "seg",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center rounded-lg surface-inset p-1 gap-1 relative select-none",
        size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 px-3 py-1 font-medium transition-colors duration-150 rounded-md focus:outline-none",
              isActive
                ? "text-slate-900 font-semibold"
                : "text-slate-600 hover:text-slate-900",
              size === "sm" ? "text-xs px-2.5 py-0.5" : "text-xs px-3 py-1"
            )}
          >
            {isActive && (
              <motion.div
                layoutId={`${layoutIdPrefix}-active-pill`}
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
                className="absolute inset-0 bg-white rounded-md shadow-xs border border-slate-200/60 -z-10"
              />
            )}
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "ml-1 text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold",
                  isActive
                    ? "bg-slate-100 text-slate-800"
                    : "bg-slate-200/60 text-slate-600"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
