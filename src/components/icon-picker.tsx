"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AppIcon, iconNames } from "./icons";
import { SearchInput } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

const POPULAR = ["Globe", "Server", "Boxes", "WalletCards", "Database", "Cloud", "HardDrive", "Router", "Shield", "KeyRound", "Bell", "Zap"];

function IconOption({ icon, selected, onPick }: { icon: string; selected: boolean; onPick: (icon: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(icon)}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
        selected ? "text-zinc-50" : "text-zinc-300",
      )}
    >
      <AppIcon name={icon} className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1 truncate">{icon}</span>
      {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden="true" /> : null}
    </button>
  );
}

export function IconPicker({ name, defaultValue = "Sparkles", locale = "en" }: { name: string; defaultValue?: string; locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const allIcons = useMemo(() => (Array.isArray(iconNames) ? iconNames : []), []);
  const filteredIcons = allIcons.filter((icon) => icon.toLowerCase().includes(query.toLowerCase())).slice(0, 80);

  function pick(icon: string) {
    setValue(icon);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={tx(locale, `Icon: ${value}`, `Иконка: ${value}`)}
            className="flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-100 transition-colors hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/25 data-[state=open]:border-white/20"
          >
            <span className="flex min-w-0 items-center gap-2">
              <AppIcon name={value} className="h-4 w-4 shrink-0 text-zinc-300" />
              <span className="truncate">{value}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <SearchInput
            size="sm"
            value={query}
            onChange={setQuery}
            autoFocus
            placeholder={tx(locale, "Search Lucide icons", "Поиск иконок Lucide")}
            clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          />
          <div className="mt-2 max-h-72 overflow-y-auto">
            {!query ? (
              <>
                <p className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{tx(locale, "Popular", "Популярные")}</p>
                <div className="grid grid-cols-2 gap-0.5">
                  {POPULAR.map((icon) => (
                    <IconOption key={icon} icon={icon} selected={value === icon} onPick={pick} />
                  ))}
                </div>
              </>
            ) : null}
            <p className="px-2 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{tx(locale, "All icons", "Все иконки")}</p>
            <div className="grid grid-cols-2 gap-0.5">
              {filteredIcons.map((icon) => (
                <IconOption key={icon} icon={icon} selected={value === icon} onPick={pick} />
              ))}
              {!filteredIcons.length ? (
                <p className="col-span-2 py-6 text-center text-[13px] text-zinc-500">{tx(locale, "No icon found.", "Ничего не найдено.")}</p>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
