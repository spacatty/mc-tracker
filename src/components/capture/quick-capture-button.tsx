"use client";

import { Plus } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCapture } from "./capture-provider";
import { Kbd, tx } from "./shared";

/** Sidebar entry point for Quick Capture. */
export function QuickCaptureButton({ collapsed, locale }: { collapsed: boolean; locale: Locale }) {
  const { openCapture } = useCapture();
  return (
    <button
      type="button"
      onClick={() => openCapture()}
      title={collapsed ? tx(locale, "New Entry (N)", "Новая запись (N)") : undefined}
      className={cn(
        "btn-aurora group flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
        collapsed && "mx-auto w-7 justify-center px-0",
      )}
    >
      <Plus className="h-3 w-3 shrink-0" />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{tx(locale, "New Entry", "Новая запись")}</span>
          <Kbd className="h-4 min-w-4 border-white/15 bg-white/10 text-[9px] text-zinc-300">N</Kbd>
        </>
      ) : null}
    </button>
  );
}

/** Page-level "add" button that opens Quick Capture, optionally prefilled. */
export function OpenCaptureButton({ label, className, text }: { label: string; className?: string; text?: string }) {
  const { openCapture } = useCapture();
  return (
    <button
      type="button"
      onClick={() => openCapture({ text })}
      className={cn("btn-aurora inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold", className)}
    >
      <Plus className="h-4 w-4" />
      {label}
      <Kbd className="border-white/15 bg-white/10 text-zinc-300">N</Kbd>
    </button>
  );
}
