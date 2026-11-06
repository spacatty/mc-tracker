import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BillingPeriod, PaymentItem } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Currencies written the way their own users write them: the symbol after the number, space-grouped ("1 884,48 ₽").
const SYMBOL_AFTER_LOCALES: Record<string, string> = { RUB: "ru-RU", UAH: "uk-UA", BYN: "be-BY", KZT: "kk-KZ" };

function moneyParts(amount: number, currency: string) {
  const formatter = new Intl.NumberFormat(SYMBOL_AFTER_LOCALES[currency] || "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  });
  // "$25.00", "€25.00", "CHF 25.00", "25,00 ₽".
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatMoney(amount: number, currency = "USD") {
  const safeCurrency = String(currency || "USD").trim().toUpperCase();
  try {
    return moneyParts(amount, /^[A-Z]{3}$/.test(safeCurrency) ? safeCurrency : "USD");
  } catch {
    return moneyParts(amount, "USD");
  }
}

export function normalizeMonthlyAmount(item: Pick<PaymentItem, "paymentType" | "amount" | "period" | "customPeriodDays">) {
  if (item.paymentType !== "recurring") {
    return 0;
  }

  switch (item.period) {
    case "7d":
      return (item.amount * 365) / 12 / 7;
    case "3m":
      return item.amount / 3;
    case "1y":
      return item.amount / 12;
    case "custom": {
      const days = item.customPeriodDays && item.customPeriodDays > 0 ? item.customPeriodDays : 30;
      return (item.amount * 365) / 12 / days;
    }
    case "1m":
    default:
      return item.amount;
  }
}

export function periodLabel(period: BillingPeriod | null, customDays?: number | null) {
  if (period === "7d") return "7 days";
  if (period === "3m") return "3 months";
  if (period === "1y") return "1 year";
  if (period === "custom") return `${customDays || 30} days`;
  return "1 month";
}

export function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function displayDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

export function nowIso() {
  return new Date().toISOString();
}

export function addBillingPeriod(start: Date, period: BillingPeriod | null, customDays?: number | null) {
  const date = new Date(start);
  if (period === "7d") date.setDate(date.getDate() + 7);
  else if (period === "3m") date.setMonth(date.getMonth() + 3);
  else if (period === "1y") date.setFullYear(date.getFullYear() + 1);
  else if (period === "custom") date.setDate(date.getDate() + (customDays && customDays > 0 ? customDays : 30));
  else date.setMonth(date.getMonth() + 1);
  return date;
}

/**
 * Category and field colours are stored as whatever the user picked, which is often a saturated swatch.
 * Blend them toward zinc so icons, badges and chips read in the app's muted palette.
 */
export function softColor(color?: string | null, strength = 70) {
  if (!color) return undefined;
  return `color-mix(in srgb, ${color} ${strength}%, #a1a1aa)`;
}

/** A faint fill derived from a category colour (chip backgrounds, bars). */
export function softFill(color?: string | null, alpha = 12) {
  if (!color) return undefined;
  return `color-mix(in srgb, ${color} ${alpha}%, transparent)`;
}
