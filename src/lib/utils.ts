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

export function formatMoney(amount: number, currency = "USD") {
  const safeCurrency = String(currency || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(safeCurrency) ? safeCurrency : "USD",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
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
