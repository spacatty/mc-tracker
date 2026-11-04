"use client";

import { Fragment } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { PaymentItem } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { daysBetween, monthlyEquivalent, periodWord, relativeDays, shortDate, todayIso, tx, urgencyTone } from "./capture/shared";
import { AppIcon } from "./icons";

/*
 * Five read-only takes on the entries table, shown side by side on /app/table-styles so the
 * owner can pick one. Whichever wins gets built into the real EntriesTable; the rest go.
 */

type Row = PaymentItem & { due: number | null };

function withDue(items: PaymentItem[]): Row[] {
  const today = todayIso();
  return items
    .map((item) => ({ ...item, due: item.billingEndAt ? daysBetween(today, item.billingEndAt) : null }))
    .sort((a, b) => (a.due ?? 9999) - (b.due ?? 9999));
}

function CategoryTag({ item, plain }: { item: PaymentItem; plain?: boolean }) {
  const color = item.categoryColor || "#71717a";
  if (plain) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{item.categoryName || "—"}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${color}18`, color }}>
      <AppIcon name={item.categoryIcon || "Tag"} className="h-3 w-3 shrink-0" />
      <span className="truncate">{item.categoryName || "—"}</span>
    </span>
  );
}

function Frame({ index, title, pitch, children }: { index: number; title: string; pitch: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-zinc-600">0{index}</span>
        <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
        <p className="truncate text-xs text-zinc-500">{pitch}</p>
      </div>
      {children}
    </section>
  );
}

/* 1 · Ledger: dense, borderless rows, numbers first-class. */
function Ledger({ rows, locale }: { rows: Row[]; locale: Locale }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-surface">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            <th className="py-2.5 pl-5 pr-3 text-left font-semibold">{tx(locale, "Entry", "Запись")}</th>
            <th className="px-3 text-left font-semibold">{tx(locale, "Category", "Категория")}</th>
            <th className="px-3 text-left font-semibold">{tx(locale, "Vendor", "Вендор")}</th>
            <th className="px-3 text-right font-semibold">{tx(locale, "Next", "След.")}</th>
            <th className="px-3 text-right font-semibold">{tx(locale, "Amount", "Сумма")}</th>
            <th className="py-2.5 pl-3 pr-5 text-right font-semibold">/{tx(locale, "mo", "мес")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={cn("transition hover:bg-white/[0.03]", index % 2 === 1 && "bg-white/[0.012]")}>
              <td className="max-w-[240px] truncate py-2 pl-5 pr-3 font-medium text-zinc-100">{row.name}</td>
              <td className="px-3"><CategoryTag item={row} plain /></td>
              <td className="max-w-[180px] truncate px-3 text-zinc-500">{row.vendorName || "—"}</td>
              <td className={cn("whitespace-nowrap px-3 text-right tabular-nums", urgencyTone(row.due))}>{shortDate(row.billingEndAt, locale)}</td>
              <td className="whitespace-nowrap px-3 text-right font-mono text-[12px] text-zinc-100">{formatMoney(row.amount, row.currency)}</td>
              <td className="whitespace-nowrap py-2 pl-3 pr-5 text-right font-mono text-[12px] text-zinc-500">
                {row.paymentType === "recurring" ? formatMoney(monthlyEquivalent(row.amount, row.paymentType, row.period, row.customPeriodDays || 30), row.currency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 2 · Grouped: one block per category with a subtotal header. */
function Grouped({ rows, locale }: { rows: Row[]; locale: Locale }) {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const key = row.categoryName || tx(locale, "Uncategorized", "Без категории");
    groups.set(key, [...(groups.get(key) || []), row]);
  });
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface">
      {[...groups.entries()].map(([name, group]) => {
        const first = group[0];
        const currency = first.currency;
        const monthly = group
          .filter((row) => row.currency === currency)
          .reduce((sum, row) => sum + monthlyEquivalent(row.amount, row.paymentType, row.period, row.customPeriodDays || 30), 0);
        return (
          <div key={name} className="border-b border-white/[0.06] last:border-b-0">
            <div className="flex items-center gap-2.5 bg-white/[0.015] px-5 py-2">
              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-zinc-600" />
              <CategoryTag item={first} />
              <span className="text-[11px] tabular-nums text-zinc-600">{group.length}</span>
              <span className="ml-auto font-mono text-[12px] text-zinc-400">{formatMoney(monthly, currency)} <span className="text-zinc-600">/ {tx(locale, "mo", "мес")}</span></span>
            </div>
            {group.map((row) => (
              <div key={row.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_110px] items-center gap-3 border-t border-white/[0.04] py-2 pl-12 pr-5 text-[13px] transition hover:bg-white/[0.02]">
                <span className="truncate text-zinc-100">{row.name}</span>
                <span className="truncate text-zinc-500">{row.vendorName || "—"}{row.accountName ? ` · ${row.accountName}` : ""}</span>
                <span className={cn("text-right text-xs tabular-nums", urgencyTone(row.due))}>{row.due === null ? "—" : relativeDays(row.due, locale)}</span>
                <span className="text-right font-medium tabular-nums text-zinc-100">{formatMoney(row.amount, row.currency)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* 3 · List: no header, two-line rows like an inbox, quiet trailing actions. */
function List({ rows, locale }: { rows: Row[]; locale: Locale }) {
  return (
    <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.08] bg-surface">
      {rows.map((row) => {
        const color = row.categoryColor || "#71717a";
        return (
          <li key={row.id} className="group flex items-center gap-3.5 px-4 py-3 transition hover:bg-white/[0.02]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${color}14`, color }}>
              <AppIcon name={row.categoryIcon || "Tag"} className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-100">{row.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {[row.vendorName, row.accountName, row.categoryName].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className={cn("text-xs tabular-nums", urgencyTone(row.due))}>{row.due === null ? "—" : relativeDays(row.due, locale)}</p>
              <p className="text-[11px] text-zinc-600">{shortDate(row.billingEndAt, locale)}</p>
            </div>
            <div className="w-28 text-right">
              <p className="text-[13px] font-semibold tabular-nums text-zinc-100">{formatMoney(row.amount, row.currency)}</p>
              <p className="text-[11px] text-zinc-600">{periodWord(row.paymentType, row.period, row.customPeriodDays || 30, locale)}</p>
            </div>
            <MoreHorizontal className="h-4 w-4 shrink-0 text-zinc-600 opacity-0 transition group-hover:opacity-100" />
          </li>
        );
      })}
    </ul>
  );
}

/* 4 · Timeline: bucketed by when money leaves, with how far each period has run. */
function Timeline({ rows, locale }: { rows: Row[]; locale: Locale }) {
  const buckets: Array<{ key: string; label: string; test: (due: number | null) => boolean }> = [
    { key: "overdue", label: tx(locale, "Overdue", "Просрочено"), test: (due) => due !== null && due < 0 },
    { key: "week", label: tx(locale, "Next 7 days", "Ближайшие 7 дней"), test: (due) => due !== null && due >= 0 && due <= 7 },
    { key: "month", label: tx(locale, "This month", "В этом месяце"), test: (due) => due !== null && due > 7 && due <= 31 },
    { key: "later", label: tx(locale, "Later", "Позже"), test: (due) => due === null || due > 31 },
  ];
  const today = todayIso();
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface">
      {buckets.map((bucket) => {
        const group = rows.filter((row) => bucket.test(row.due));
        if (!group.length) return null;
        return (
          <Fragment key={bucket.key}>
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {bucket.label}
              <span className="tabular-nums text-zinc-600">{group.length}</span>
            </div>
            {group.map((row) => {
              const span = row.billingStartAt && row.billingEndAt ? Math.max(daysBetween(row.billingStartAt, row.billingEndAt), 1) : 0;
              const elapsed = span && row.billingStartAt ? Math.min(Math.max(daysBetween(row.billingStartAt, today) / span, 0), 1) : 0;
              return (
                <div key={row.id} className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,160px)_100px] items-center gap-4 border-b border-white/[0.04] px-5 py-2.5 text-[13px] last:border-b-0">
                  <span className="text-xs tabular-nums text-zinc-400">{shortDate(row.billingEndAt, locale)}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: row.categoryColor || "#71717a" }} />
                    <span className="truncate text-zinc-100">{row.name}</span>
                    <span className="truncate text-zinc-600">{row.vendorName}</span>
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-white/[0.06]" title={`${Math.round(elapsed * 100)}%`}>
                    <span className={cn("block h-full rounded-full", (row.due ?? 99) < 0 ? "bg-red-400/70" : (row.due ?? 99) <= 7 ? "bg-amber-300/70" : "bg-zinc-400/50")} style={{ width: `${elapsed * 100}%` }} />
                  </span>
                  <span className="text-right font-medium tabular-nums text-zinc-100">{formatMoney(row.amount, row.currency)}</span>
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

/* 5 · Sheet: gridlines, compact 32px rows, everything visible at once. */
function Sheet({ rows, locale }: { rows: Row[]; locale: Locale }) {
  const head = "border-b border-r border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-left text-[11px] font-medium text-zinc-500 last:border-r-0";
  const cell = "h-8 border-b border-r border-white/[0.05] px-2.5 last:border-r-0";
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-surface">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th className={cn(head, "w-10 text-center")}>#</th>
            <th className={head}>{tx(locale, "Name", "Название")}</th>
            <th className={head}>{tx(locale, "Category", "Категория")}</th>
            <th className={head}>{tx(locale, "Vendor", "Вендор")}</th>
            <th className={head}>{tx(locale, "Account", "Аккаунт")}</th>
            <th className={head}>{tx(locale, "Start", "Начало")}</th>
            <th className={head}>{tx(locale, "End", "Конец")}</th>
            <th className={cn(head, "text-right")}>{tx(locale, "Amount", "Сумма")}</th>
            <th className={head}>{tx(locale, "Cur", "Вал")}</th>
            <th className={head}>{tx(locale, "Period", "Период")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="hover:bg-violet-500/[0.04]">
              <td className={cn(cell, "text-center font-mono text-[11px] text-zinc-600")}>{index + 1}</td>
              <td className={cn(cell, "max-w-[200px] truncate font-medium text-zinc-100")}>{row.name}</td>
              <td className={cn(cell, "max-w-[160px]")}><CategoryTag item={row} plain /></td>
              <td className={cn(cell, "max-w-[140px] truncate text-zinc-400")}>{row.vendorName}</td>
              <td className={cn(cell, "max-w-[140px] truncate text-zinc-400")}>{row.accountName}</td>
              <td className={cn(cell, "whitespace-nowrap font-mono text-[11px] text-zinc-500")}>{row.billingStartAt?.slice(0, 10) || ""}</td>
              <td className={cn(cell, "whitespace-nowrap font-mono text-[11px]", urgencyTone(row.due))}>{row.billingEndAt?.slice(0, 10) || ""}</td>
              <td className={cn(cell, "text-right font-mono text-zinc-100")}>{row.amount.toFixed(2)}</td>
              <td className={cn(cell, "font-mono text-[11px] text-zinc-500")}>{row.currency}</td>
              <td className={cn(cell, "text-zinc-400")}>{periodWord(row.paymentType, row.period, row.customPeriodDays || 30, locale, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableVariants({ items, locale }: { items: PaymentItem[]; locale: Locale }) {
  const rows = withDue(items).slice(0, 10);
  if (!rows.length) {
    return <p className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-zinc-500">{tx(locale, "Add a few entries to this workspace to preview the styles.", "Добавьте записи в пространство, чтобы увидеть варианты.")}</p>;
  }
  return (
    <div className="space-y-10">
      <Frame index={1} title={tx(locale, "Ledger", "Реестр")} pitch={tx(locale, "Dense rows, no borders, money columns up front.", "Плотные строки без рамок, деньги на первом плане.")}>
        <Ledger rows={rows} locale={locale} />
      </Frame>
      <Frame index={2} title={tx(locale, "Grouped", "По категориям")} pitch={tx(locale, "One block per category with its monthly subtotal.", "Блок на категорию с суммой в месяц.")}>
        <Grouped rows={rows} locale={locale} />
      </Frame>
      <Frame index={3} title={tx(locale, "List", "Список")} pitch={tx(locale, "Two-line rows like an inbox; details on hover.", "Двухстрочные строки как во входящих.")}>
        <List rows={rows} locale={locale} />
      </Frame>
      <Frame index={4} title={tx(locale, "Timeline", "Таймлайн")} pitch={tx(locale, "Bucketed by due date, with how far each period has run.", "По срокам оплаты, с прогрессом периода.")}>
        <Timeline rows={rows} locale={locale} />
      </Frame>
      <Frame index={5} title={tx(locale, "Sheet", "Таблица")} pitch={tx(locale, "Spreadsheet gridlines, every field visible.", "Сетка как в таблице, все поля видны.")}>
        <Sheet rows={rows} locale={locale} />
      </Frame>
    </div>
  );
}
