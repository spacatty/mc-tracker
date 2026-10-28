import type { PaymentType } from "./types";

export type EntryStatus = "overdue" | "due-soon" | "active" | "ended" | "no-date";

export const DUE_SOON_DAYS = 14;

function dayStart(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * At-a-glance state of an entry from its end/renewal date, matching how the
 * dashboard's upcoming list treats billingEndAt as the current due date.
 */
export function entryStatus(entry: { paymentType: PaymentType; billingEndAt?: string | null }, now = new Date()) {
  if (!entry.billingEndAt) return { status: "no-date" as EntryStatus, days: null };
  const due = new Date(entry.billingEndAt.length === 10 ? `${entry.billingEndAt}T00:00:00` : entry.billingEndAt);
  if (Number.isNaN(due.getTime())) return { status: "no-date" as EntryStatus, days: null };
  const days = Math.round((dayStart(due).getTime() - dayStart(now).getTime()) / 86_400_000);
  if (days < 0) return { status: (entry.paymentType === "single" ? "ended" : "overdue") as EntryStatus, days };
  if (days <= DUE_SOON_DAYS) return { status: "due-soon" as EntryStatus, days };
  return { status: "active" as EntryStatus, days };
}
