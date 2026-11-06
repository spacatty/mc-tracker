"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import type { Locale } from "@/lib/i18n";
import type { BillingPeriod, Category, PaymentType } from "@/lib/types";
import { cn, softColor, softFill } from "@/lib/utils";
import { AppIcon } from "../icons";
import { tx } from "./shared";

export const inputClass =
  "h-9 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-400/50 focus:bg-violet-500/[0.06]";

export type PeriodValue = { paymentType: PaymentType; period: BillingPeriod | null; customDays: number };

const PERIOD_OPTIONS: Array<{ key: string; value: PeriodValue; en: string; ru: string }> = [
  { key: "once", value: { paymentType: "single", period: null, customDays: 30 }, en: "Once", ru: "Разово" },
  { key: "7d", value: { paymentType: "recurring", period: "7d", customDays: 30 }, en: "Week", ru: "Неделя" },
  { key: "1m", value: { paymentType: "recurring", period: "1m", customDays: 30 }, en: "Month", ru: "Месяц" },
  { key: "3m", value: { paymentType: "recurring", period: "3m", customDays: 30 }, en: "Quarter", ru: "Квартал" },
  { key: "1y", value: { paymentType: "recurring", period: "1y", customDays: 30 }, en: "Year", ru: "Год" },
  { key: "custom", value: { paymentType: "recurring", period: "custom", customDays: 30 }, en: "Days…", ru: "Дни…" },
];

function periodKey(value: PeriodValue) {
  return value.paymentType === "single" ? "once" : value.period || "1m";
}

export function PeriodPicker({ value, onChange, locale }: { value: PeriodValue; onChange: (value: PeriodValue) => void; locale: Locale }) {
  const active = periodKey(value);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange({ ...option.value, customDays: value.customDays || 30 })}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs font-medium transition",
              active === option.key ? "bg-violet-500/25 text-violet-50 shadow-inner shadow-violet-500/20" : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
            )}
          >
            {tx(locale, option.en, option.ru)}
          </button>
        ))}
      </div>
      {active === "custom" ? (
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          {tx(locale, "Every", "Каждые")}
          <input
            type="number"
            min={1}
            className={cn(inputClass, "h-8 w-20")}
            value={value.customDays}
            onChange={(event) => onChange({ ...value, customDays: Math.max(1, Number(event.target.value) || 1) })}
          />
          {tx(locale, "days", "дн.")}
        </label>
      ) : null}
    </div>
  );
}

export function CategoryList({
  categories,
  value,
  onSelect,
  locale,
}: {
  categories: Category[];
  value: number | null;
  onSelect: (id: number | null) => void;
  locale: Locale;
}) {
  return (
    <div className="max-h-64 space-y-0.5 overflow-auto">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/[0.06]",
            value === category.id && "bg-white/[0.06]",
          )}
        >
          <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: softFill(category.color), color: softColor(category.color) }}>
            <AppIcon name={category.icon} className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 truncate text-zinc-100">{category.name}</span>
          {value === category.id ? <Check className="h-3.5 w-3.5 text-violet-300" /> : null}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-400 transition hover:bg-white/[0.06]", value === null && "bg-white/[0.06]")}
      >
        <span className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-white/15" />
        {tx(locale, "No category", "Без категории")}
      </button>
    </div>
  );
}

/** Text input that commits on Enter or blur and cancels on Escape. */
export function CommitInput({
  value,
  onCommit,
  onCancel,
  className,
  autoFocus = true,
  type = "text",
  placeholder,
  list,
  selectOnFocus = true,
}: {
  value: string;
  onCommit: (value: string) => void;
  onCancel?: () => void;
  className?: string;
  autoFocus?: boolean;
  type?: string;
  placeholder?: string;
  list?: string;
  selectOnFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus();
      if (selectOnFocus) ref.current?.select();
    }
  }, [autoFocus, selectOnFocus]);
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      ref.current?.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      onCancel?.();
    }
  }
  return (
    <input
      ref={ref}
      type={type}
      list={list}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (cancelled.current) return;
        if (draft !== value) onCommit(draft);
        else onCancel?.();
      }}
      className={cn(inputClass, className)}
    />
  );
}

export function CurrencySelect({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={cn(inputClass, "w-24 cursor-pointer px-2", className)}>
      {SUPPORTED_CURRENCIES.map((currency) => (
        <option key={currency.code} value={currency.code} className="bg-zinc-900">
          {currency.code}
        </option>
      ))}
    </select>
  );
}

export function addPeriodIso(dateIso: string, value: PeriodValue) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  if (value.paymentType === "single") return dateIso;
  if (value.period === "7d") date.setUTCDate(date.getUTCDate() + 7);
  else if (value.period === "3m") date.setUTCMonth(date.getUTCMonth() + 3);
  else if (value.period === "1y") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else if (value.period === "custom") date.setUTCDate(date.getUTCDate() + (value.customDays || 30));
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}
