"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TooltipSide = "top" | "bottom";
export type TooltipAlign = "start" | "center" | "end";

/**
 * Lightweight CSS tooltip — hover/focus driven, no portal, no dependency.
 *
 * The wrapper is an inline-flex span by default, but every positioning class is
 * overridable, so it can stand in for an absolutely positioned element (a
 * timeline bar, for example) by passing the position classes plus `style`.
 * `cn` runs tailwind-merge, so the passed classes win over the defaults.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  className,
  bubbleClassName,
  style,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  className?: string;
  bubbleClassName?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("group/tt relative inline-flex", className)} style={style}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute z-30 w-max max-w-[240px] translate-y-1 rounded-lg bg-ink px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg ring-1 ring-white/10 transition duration-150 ease-out",
          "group-hover/tt:visible group-hover/tt:translate-y-0 group-hover/tt:opacity-100",
          "group-focus-within/tt:visible group-focus-within/tt:translate-y-0 group-focus-within/tt:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
          bubbleClassName
        )}
      >
        {content}
        <span
          aria-hidden
          className={cn(
            "absolute h-2 w-2 rotate-45 bg-ink",
            side === "top" ? "-bottom-1 border-b border-r border-white/10" : "-top-1 border-l border-t border-white/10",
            align === "start" && "left-3",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-3"
          )}
        />
      </span>
    </span>
  );
}
