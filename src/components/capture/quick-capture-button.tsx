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
        "group flex h-8 w-full items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-2.5 text-left text-[13px] font-medium text-violet-100 transition hover:border-violet-400/30 hover:bg-violet-500/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 active:scale-[0.98]",
        collapsed && "mx-auto w-9 justify-center px-0",
      )}
    >
      <Plus className="h-3.5 w-3.5 shrink-0 text-violet-300 transition group-hover:rotate-90" />
      {!collapsed ? (
        <>
          <span className="flex-1">{tx(locale, "Add anything", "Добавить")}</span>
          <Kbd className="h-[18px] min-w-[18px] border-violet-400/20 bg-violet-500/10 text-violet-200/80">N</Kbd>
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
