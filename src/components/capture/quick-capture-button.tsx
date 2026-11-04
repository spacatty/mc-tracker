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
      title={collapsed ? tx(locale, "Create new entry (N)", "Новая запись (N)") : undefined}
      className={cn(
        "group flex h-8 w-full items-center gap-2 rounded-lg bg-zinc-100 px-2.5 text-left text-[13px] font-semibold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_6px_16px_-8px_rgba(0,0,0,0.8)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 active:scale-[0.98]",
        collapsed && "mx-auto w-8 justify-center px-0",
      )}
    >
      <Plus className="h-3.5 w-3.5 shrink-0 transition group-hover:rotate-90" />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{tx(locale, "Create new entry", "Новая запись")}</span>
          <Kbd className="h-[18px] min-w-[18px] border-black/10 bg-black/[0.06] text-zinc-500">N</Kbd>
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
      className={cn("inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.98]", className)}
    >
      <Plus className="h-4 w-4" />
      {label}
      <Kbd className="border-black/10 bg-black/5 text-zinc-600">N</Kbd>
    </button>
  );
}
