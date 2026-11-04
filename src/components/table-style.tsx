"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Rows3 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { tx } from "./capture/shared";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu";

/*
 * App-wide table look. The choice lives on <html data-table-style> so every table
 * (entries, dashboard, archive, admin) restyles from globals.css without prop plumbing,
 * and it is saved in localStorage the moment it changes.
 */

export type TableStyle = "current" | "ledger" | "sheet";

const STORAGE_KEY = "mc-tracker-table-style";
const STYLES: TableStyle[] = ["current", "ledger", "sheet"];
const CHANGE_EVENT = "mc-table-style";

function readStyle(): TableStyle {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as TableStyle | null;
    return stored && STYLES.includes(stored) ? stored : "current";
  } catch {
    return "current";
  }
}

function applyStyle(style: TableStyle) {
  if (style === "current") delete document.documentElement.dataset.tableStyle;
  else document.documentElement.dataset.tableStyle = style;
}

/** Applies the saved style on load; mounted once in the app shell. */
export function TableStyleSync() {
  useEffect(() => {
    applyStyle(readStyle());
  }, []);
  return null;
}

function label(style: TableStyle, locale: Locale) {
  if (style === "ledger") return tx(locale, "Ledger", "Реестр");
  if (style === "sheet") return tx(locale, "Sheet", "Таблица");
  return tx(locale, "Current", "Обычный");
}

function hint(style: TableStyle, locale: Locale) {
  if (style === "ledger") return tx(locale, "Dense, borderless, zebra rows", "Плотно, без линий, полосы");
  if (style === "sheet") return tx(locale, "Gridlines, compact 32px rows", "Сетка, компактные строки");
  return tx(locale, "Default spacing and dividers", "Обычные отступы и линии");
}

export function TableStyleSelect({ locale }: { locale: Locale }) {
  const [style, setStyle] = useState<TableStyle>("current");

  useEffect(() => {
    const sync = () => setStyle(readStyle());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  function choose(next: TableStyle) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the style still applies for this page view.
    }
    applyStyle(next);
    setStyle(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm" aria-label={tx(locale, "Table style", "Стиль таблицы")}>
          <Rows3 className="h-3.5 w-3.5" />
          {label(style, locale)}
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{tx(locale, "Table style", "Стиль таблицы")}</DropdownMenuLabel>
        {STYLES.map((option) => (
          <DropdownMenuCheckboxItem key={option} checked={style === option} onCheckedChange={() => choose(option)}>
            <span className="min-w-0">
              <span className="block text-zinc-100">{label(option, locale)}</span>
              <span className="block text-[11px] text-zinc-500">{hint(option, locale)}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
