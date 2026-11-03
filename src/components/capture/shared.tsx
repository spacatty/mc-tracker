"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { TokenKind } from "@/lib/capture/syntax";
import type { Locale } from "@/lib/i18n";
import type { BillingPeriod, PaymentType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** Text colour + soft background per token kind, shared by the editor highlight and the legend. */
export const TOKEN_STYLES: Record<TokenKind, string> = {
  name: "text-zinc-50",
  category: "text-violet-200 bg-violet-500/20 shadow-[0_0_0_2px_rgba(139,92,246,0.20)]",
  vendor: "text-sky-200 bg-sky-500/15 shadow-[0_0_0_2px_rgba(14,165,233,0.15)]",
  money: "text-emerald-200 bg-emerald-500/15 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]",
  period: "text-emerald-200 bg-emerald-500/15 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]",
  date: "text-amber-200 bg-amber-500/15 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]",
  field: "text-fuchsia-200 bg-fuchsia-500/15 shadow-[0_0_0_2px_rgba(217,70,239,0.15)]",
  ip: "text-cyan-200 bg-cyan-500/15 shadow-[0_0_0_2px_rgba(6,182,212,0.15)]",
  url: "text-blue-300 underline decoration-blue-400/40 underline-offset-4",
  notes: "text-zinc-500 italic",
  action: "text-orange-200 bg-orange-500/20 shadow-[0_0_0_2px_rgba(249,115,22,0.2)]",
};

export const TOKEN_DOT: Record<TokenKind, string> = {
  name: "bg-zinc-300",
  category: "bg-violet-400",
  vendor: "bg-sky-400",
  money: "bg-emerald-400",
  period: "bg-emerald-400",
  date: "bg-amber-400",
  field: "bg-fuchsia-400",
  ip: "bg-cyan-400",
  url: "bg-blue-400",
  notes: "bg-zinc-500",
  action: "bg-orange-400",
};

export function periodWord(paymentType: PaymentType, period: BillingPeriod | null, customDays: number, locale: Locale, short = false) {
  if (paymentType === "single") return tx(locale, "one-time", "разово");
  if (period === "7d") return short ? tx(locale, "wk", "нед") : tx(locale, "week", "неделю");
  if (period === "3m") return short ? tx(locale, "qtr", "кв") : tx(locale, "quarter", "квартал");
  if (period === "1y") return short ? tx(locale, "yr", "год") : tx(locale, "year", "год");
  if (period === "custom") return tx(locale, `${customDays || 30} days`, `${customDays || 30} дн.`);
  return short ? tx(locale, "mo", "мес") : tx(locale, "month", "месяц");
}

export function billingSentence(paymentType: PaymentType, period: BillingPeriod | null, customDays: number, locale: Locale) {
  if (paymentType === "single") return tx(locale, "One-time payment", "Разовый платёж");
  if (period === "7d") return tx(locale, "Every week", "Каждую неделю");
  if (period === "3m") return tx(locale, "Every quarter", "Каждый квартал");
  if (period === "1y") return tx(locale, "Every year", "Каждый год");
  if (period === "custom") return tx(locale, `Every ${customDays || 30} days`, `Каждые ${customDays || 30} дн.`);
  return tx(locale, "Every month", "Каждый месяц");
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

export function shortDate(value: string | null | undefined, locale: Locale, withYear = false) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
  return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear || !sameYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function relativeDays(days: number, locale: Locale) {
  if (days === 0) return tx(locale, "today", "сегодня");
  if (days === 1) return tx(locale, "tomorrow", "завтра");
  if (days === -1) return tx(locale, "yesterday", "вчера");
  if (days > 0) {
    if (days < 60) return tx(locale, `in ${days} days`, `через ${days} дн.`);
    const months = Math.round(days / 30.4);
    return tx(locale, `in ${months} months`, `через ${months} мес.`);
  }
  const ago = Math.abs(days);
  return tx(locale, `${ago} days overdue`, `просрочено на ${ago} дн.`);
}

export function urgencyTone(days: number | null) {
  if (days === null) return "text-zinc-400";
  if (days < 0) return "text-red-300";
  if (days <= 7) return "text-amber-300";
  if (days <= 30) return "text-sky-200";
  return "text-emerald-200";
}

export function monthlyEquivalent(amount: number, paymentType: PaymentType, period: BillingPeriod | null, customDays: number) {
  if (paymentType !== "recurring") return 0;
  if (period === "7d") return (amount * 365) / 12 / 7;
  if (period === "3m") return amount / 3;
  if (period === "1y") return amount / 12;
  if (period === "custom") return (amount * 365) / 12 / (customDays || 30);
  return amount;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-white/10 bg-white/[0.06] px-1 font-sans text-[10px] font-medium text-zinc-400", className)}>
      {children}
    </kbd>
  );
}

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "violet" | "sky" | "emerald" | "amber" | "fuchsia" | "cyan" | "orange" | "ghost" | "red";
  icon?: ReactNode;
  muted?: boolean;
};

const CHIP_TONES: Record<NonNullable<ChipProps["tone"]>, string> = {
  default: "border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]",
  violet: "border-violet-400/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20",
  sky: "border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20",
  emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
  amber: "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20",
  fuchsia: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20",
  cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20",
  orange: "border-orange-400/25 bg-orange-500/10 text-orange-100 hover:bg-orange-500/20",
  red: "border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20",
  ghost: "border-dashed border-white/15 bg-transparent text-zinc-500 hover:border-white/30 hover:text-zinc-200",
};

/** Small pill that opens an editor; the building block of capture cards. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ tone = "default", icon, muted, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 active:scale-[0.97]",
        CHIP_TONES[tone],
        muted && "opacity-70",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
});
