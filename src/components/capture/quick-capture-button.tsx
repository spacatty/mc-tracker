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
        "group relative flex w-full items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-left text-[13px] font-medium text-zinc-100 transition hover:bg-white/[0.08]",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-zinc-100 transition group-hover:rotate-90">
        <Plus className="h-4 w-4" />
      </span>
      {!collapsed ? (
        <>
          <span className="flex-1">{tx(locale, "Add anything", "Добавить")}</span>
          <Kbd>N</Kbd>
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
      className={cn("inline-flex h-9 items-center gap-2 rounded-xl bg-zinc-100 px-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.98]", className)}
    >
      <Plus className="h-4 w-4" />
      {label}
      <Kbd className="border-black/10 bg-black/5 text-zinc-600">N</Kbd>
    </button>
  );
}
