"use client";

import { forwardRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Kbd } from "./shared";

export type MenuSuggestion = { key: string; label: string; icon?: ReactNode; detail?: string; match?: string; group?: string };

/** Indices of `label` that match `query`: a contiguous run when it is a substring, otherwise letters in order. */
export function matchIndices(query: string | undefined, label: string) {
  const hits = new Set<number>();
  const q = (query || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!q) return hits;
  const lower = label.toLowerCase();
  const at = lower.indexOf(q);
  if (at >= 0) {
    for (let i = 0; i < q.length; i += 1) hits.add(at + i);
    return hits;
  }
  let index = 0;
  for (let i = 0; i < lower.length && index < q.length; i += 1) {
    if (lower[i] === q[index]) {
      hits.add(i);
      index += 1;
    }
  }
  return index === q.length ? hits : new Set<number>();
}

function Highlighted({ label, query }: { label: string; query?: string }) {
  const hits = matchIndices(query, label);
  if (!hits.size) return <>{label}</>;
  return (
    <>
      {[...label].map((char, index) => (
        <span key={index} className={hits.has(index) ? "font-semibold text-white" : undefined}>{char}</span>
      ))}
    </>
  );
}

/** Initial-letter avatar for vendors and accounts. */
export function LetterIcon({ text }: { text: string }) {
  const letter = (text.replace(/^[@"]+/, "").trim()[0] || "?").toUpperCase();
  return <span className="text-[11px] font-semibold text-zinc-300">{letter}</span>;
}

type Props = {
  title: string;
  icon?: ReactNode;
  progress?: string;
  items: MenuSuggestion[];
  selected: number;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
  labels: { navigate: string; pick: string; close: string };
};

/**
 * Combobox-style list that floats under the word being typed. It is portalled to <body> so the dialog's
 * overflow never clips it; the parent positions it (style.top/left) from the caret.
 */
export const SuggestMenu = forwardRef<HTMLDivElement, Props>(function SuggestMenu({ title, icon, progress, items, selected, onHover, onPick, labels }, ref) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      data-suggest-menu
      role="listbox"
      className="suggest-in pointer-events-auto fixed left-0 top-0 z-[60] w-[min(340px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/10 bg-[#18181c]/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {icon ? <span className="text-zinc-400">{icon}</span> : null}
        <span className="truncate">{title}</span>
        {progress ? <span className="ml-auto font-medium normal-case tracking-normal text-zinc-600">{progress}</span> : null}
      </div>
      <div className="max-h-[288px] overflow-y-auto px-1.5 pb-1.5">
        {items.map((item, index) => {
          const active = index === selected;
          const groupStart = item.group && item.group !== items[index - 1]?.group;
          return (
            <div key={item.key}>
              {groupStart ? <div className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-600">{item.group}</div> : null}
              <div
                role="option"
                aria-selected={active}
                ref={active ? (node) => node?.scrollIntoView({ block: "nearest" }) : undefined}
                onMouseMove={() => { if (!active) onHover(index); }}
                onMouseDown={(event) => { event.preventDefault(); onPick(index); }}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm transition-colors",
                  active ? "bg-white/[0.08] text-zinc-100" : "text-zinc-300",
                )}
              >
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors", active ? "border-white/15 bg-white/[0.08]" : "border-white/[0.06] bg-white/[0.03]")}>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 truncate"><Highlighted label={item.label} query={item.match} /></span>
                {item.detail ? <span className="max-w-[40%] shrink-0 truncate text-xs text-zinc-500">{item.detail}</span> : null}
                {active ? <Kbd className="shrink-0">↵</Kbd> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 border-t border-white/[0.06] px-3 py-2 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd>{labels.navigate}</span>
        <span className="flex items-center gap-1"><Kbd>↵</Kbd><Kbd>Tab</Kbd>{labels.pick}</span>
        <span className="ml-auto flex items-center gap-1"><Kbd>Esc</Kbd>{labels.close}</span>
      </div>
    </div>,
    document.body,
  );
});
