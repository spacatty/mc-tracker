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
      title={collapsed ? tx(locale, "Add (N)", "Добавить (N)") : undefined}
      className={cn(
        "group relative flex w-full items-center gap-2 overflow-hidden rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-transparent px-2 py-2 text-left text-[13px] font-medium text-violet-50 shadow-[0_8px_30px_-12px_rgba(139,92,246,0.6)] transition hover:border-violet-300/45 hover:from-violet-500/30",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/30 text-violet-50 transition group-hover:rotate-90">
        <Plus className="h-4 w-4" />
      </span>
      {!collapsed ? (
        <>
          <span className="flex-1">{tx(locale, "Add anything", "Добавить")}</span>
          <Kbd className="border-violet-300/20 bg-violet-500/10 text-violet-200">N</Kbd>
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
      className={cn("inline-flex h-9 items-center gap-2 rounded-xl bg-violet-500 px-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-400 active:scale-[0.98]", className)}
    >
      <Plus className="h-4 w-4" />
      {label}
      <Kbd className="border-white/20 bg-white/10 text-white/80">N</Kbd>
    </button>
  );
}
