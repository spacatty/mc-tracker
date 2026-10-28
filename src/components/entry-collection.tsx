"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, Check, Copy, ExternalLink, PencilLine, Trash2 } from "lucide-react";
import { entryStatus, type EntryStatus } from "@/lib/entry-status";
import type { Locale } from "@/lib/i18n";
import type { BillingPeriod, Category, PaymentType } from "@/lib/types";
import { cn, displayDate, formatMoney, normalizeMonthlyAmount, periodLabel } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export type EntryView = {
  id: number;
  name: string;
  categoryId: number | null;
  paymentType: PaymentType;
  amount: number;
  currency: string;
  period: BillingPeriod | null;
  customPeriodDays: number | null;
  billingStartAt: string | null;
  billingEndAt: string | null;
  vendorName: string;
  vendorUrl: string;
  accountName: string;
  notes: string;
  customFields: Record<string, unknown>;
};

export type CollectionLayout = "cards" | "list";
export type CollectionGroup = "none" | "category" | "status" | "vendor" | "account";

const STATUS_ORDER: EntryStatus[] = ["overdue", "due-soon", "active", "ended", "no-date"];
const STATUS_STYLE: Record<EntryStatus, { dot: string; text: string; ring: string; edge: string }> = {
  overdue: { dot: "bg-red-400", text: "text-red-200", ring: "ring-red-400/30 bg-red-500/10", edge: "before:bg-red-400/80" },
  "due-soon": { dot: "bg-amber-400", text: "text-amber-100", ring: "ring-amber-400/30 bg-amber-500/10", edge: "before:bg-amber-400/80" },
  active: { dot: "bg-emerald-400", text: "text-emerald-100", ring: "ring-emerald-400/25 bg-emerald-500/10", edge: "before:bg-emerald-400/60" },
  ended: { dot: "bg-zinc-500", text: "text-zinc-300", ring: "ring-zinc-500/30 bg-zinc-500/10", edge: "before:bg-zinc-500/60" },
  "no-date": { dot: "bg-zinc-600", text: "text-muted-foreground", ring: "ring-border bg-surface-raised", edge: "before:bg-zinc-600/50" },
};

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

export function statusLabel(status: EntryStatus, locale: Locale) {
  const labels: Record<EntryStatus, [string, string]> = {
    overdue: ["Overdue", "Просрочено"],
    "due-soon": ["Due soon", "Скоро оплата"],
    active: ["Active", "Активно"],
    ended: ["Ended", "Завершено"],
    "no-date": ["No date", "Без даты"],
  };
  return tx(locale, ...labels[status]);
}

function dueText(status: EntryStatus, days: number | null, locale: Locale) {
  if (days === null) return tx(locale, "No renewal date", "Нет даты продления");
  if (status === "overdue") return tx(locale, `Overdue by ${-days} d`, `Просрочено на ${-days} дн.`);
  if (status === "ended") return tx(locale, "Ended", "Завершено");
  if (days === 0) return tx(locale, "Due today", "Сегодня");
  if (days === 1) return tx(locale, "Due tomorrow", "Завтра");
  return tx(locale, `In ${days} d`, `Через ${days} дн.`);
}

function billingText(entry: EntryView, locale: Locale) {
  if (entry.paymentType !== "recurring") return tx(locale, "one-time", "разово");
  const label = periodLabel(entry.period, entry.customPeriodDays);
  return locale === "ru" ? `/ ${label.replace("days", "дн.").replace("months", "мес.").replace("month", "мес.").replace("year", "год")}` : `/ ${label}`;
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function StatusPill({ status, days, locale }: { status: EntryStatus; days: number | null; locale: Locale }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", style.ring, style.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {status === "active" || status === "no-date" ? statusLabel(status, locale) : dueText(status, days, locale)}
    </span>
  );
}

function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      title={`${label}: ${value}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:border-border-strong hover:text-foreground"
    >
      <span className="shrink-0 font-sans text-subtle-foreground">{label}</span>
      <span className="truncate">{value}</span>
      {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-300" /> : null}
    </button>
  );
}

type GroupBucket = { key: string; label: string; color?: string; icon?: string; entries: EntryView[] };

export function EntryCollection({
  entries,
  categories,
  layout,
  group,
  selectedIds,
  readOnly,
  workspaceId,
  showCategory,
  pending,
  locale,
  onToggleSelect,
  onDuplicate,
  onArchive,
  onDelete,
  onEditInGrid,
}: {
  entries: EntryView[];
  categories: Category[];
  layout: CollectionLayout;
  group: CollectionGroup;
  selectedIds: Set<number>;
  readOnly: boolean;
  workspaceId: number;
  showCategory: boolean;
  pending: boolean;
  locale: Locale;
  onToggleSelect: (id: number, checked: boolean) => void;
  onDuplicate: (id: number) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onEditInGrid: (id: number) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const statusById = useMemo(() => new Map(entries.map((entry) => [entry.id, entryStatus(entry)])), [entries]);

  const groups = useMemo<GroupBucket[]>(() => {
    if (group === "none") return [{ key: "all", label: "", entries }];
    const buckets = new Map<string, GroupBucket>();
    entries.forEach((entry) => {
      let key: string;
      let bucket: Omit<GroupBucket, "entries">;
      if (group === "category") {
        const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
        key = String(category?.id || "none");
        bucket = { key, label: category?.name || tx(locale, "Uncategorized", "Без категории"), color: category?.color, icon: category?.icon };
      } else if (group === "status") {
        key = statusById.get(entry.id)!.status;
        bucket = { key, label: statusLabel(key as EntryStatus, locale) };
      } else {
        const value = (group === "vendor" ? entry.vendorName || hostLabel(entry.vendorUrl) : entry.accountName).trim();
        key = value.toLowerCase() || "—";
        bucket = { key, label: value || (group === "vendor" ? tx(locale, "No vendor", "Без поставщика") : tx(locale, "No account", "Без аккаунта")) };
      }
      if (!buckets.has(key)) buckets.set(key, { ...bucket, entries: [] });
      buckets.get(key)!.entries.push(entry);
    });
    const list = [...buckets.values()];
    if (group === "status") return list.sort((a, b) => STATUS_ORDER.indexOf(a.key as EntryStatus) - STATUS_ORDER.indexOf(b.key as EntryStatus));
    if (group === "category") {
      return list.sort((a, b) => (categoryById.get(Number(a.key))?.sortOrder ?? 1e9) - (categoryById.get(Number(b.key))?.sortOrder ?? 1e9));
    }
    return list.sort((a, b) => b.entries.length - a.entries.length || a.label.localeCompare(b.label));
  }, [categoryById, entries, group, locale, statusById]);

  const open = openId ? entries.find((entry) => entry.id === openId) : undefined;
  // Render at most visibleCount entries across all groups ("show more" extends it).
  const visibleGroups = groups.reduce<{ remaining: number; list: Array<GroupBucket & { shown: EntryView[] }> }>(
    (acc, bucket) => {
      if (acc.remaining <= 0) return acc;
      const shown = bucket.entries.slice(0, acc.remaining);
      return { remaining: acc.remaining - shown.length, list: [...acc.list, { ...bucket, shown }] };
    },
    { remaining: visibleCount, list: [] },
  ).list;

  function groupTotal(bucket: GroupBucket) {
    const currencies = new Set(bucket.entries.map((entry) => entry.currency));
    if (currencies.size !== 1) return null;
    const monthly = bucket.entries.reduce((sum, entry) => sum + normalizeMonthlyAmount(entry), 0);
    return monthly ? `≈ ${formatMoney(monthly, [...currencies][0])} ${tx(locale, "/ mo", "/ мес")}` : null;
  }

  function renderActions(entry: EntryView, compact = false) {
    if (readOnly) return null;
    const size = compact ? "h-7 w-7" : "h-8 w-8";
    return (
      <div className={cn("flex shrink-0 items-center gap-0.5", compact && "opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100")}>
        <Button type="button" variant="ghost" size="icon" className={size} onClick={(event) => { event.stopPropagation(); onDuplicate(entry.id); }} title={tx(locale, "Duplicate", "Дублировать")} aria-label={tx(locale, "Duplicate", "Дублировать")}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={size} disabled={pending} onClick={(event) => { event.stopPropagation(); onArchive(entry.id); }} title={tx(locale, "Archive", "Архивировать")} aria-label={tx(locale, "Archive", "Архивировать")}>
          <Archive className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={cn(size, "text-red-300")} disabled={pending} onClick={(event) => { event.stopPropagation(); onDelete(entry.id); }} title={tx(locale, "Delete", "Удалить")} aria-label={tx(locale, "Delete", "Удалить")}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  function renderCard(entry: EntryView) {
    const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
    const { status, days } = statusById.get(entry.id)!;
    const chips = (category?.fields || []).filter((field) => field.showInTable && String(entry.customFields[field.id] ?? "").trim() && field.type !== "checkbox").slice(0, 3);
    return (
      <article
        key={entry.id}
        onClick={() => setOpenId(entry.id)}
        className={cn(
          "group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-lg border border-border bg-surface p-4 pl-5 transition hover:border-border-strong hover:bg-surface-raised",
          "before:absolute before:inset-y-0 before:left-0 before:w-1",
          STATUS_STYLE[status].edge,
          selectedIds.has(entry.id) && "border-violet-400/50 bg-violet-500/[0.05]",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-muted" style={{ color: category?.color || undefined }}>
            <AppIcon name={category?.icon || "Circle"} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold leading-tight text-foreground" title={entry.name}>{entry.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[showCategory && group !== "category" ? category?.name || tx(locale, "Uncategorized", "Без категории") : null, entry.vendorName || (entry.vendorUrl ? hostLabel(entry.vendorUrl) : null), entry.accountName].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          {!readOnly ? (
            <span onClick={(event) => event.stopPropagation()} className={cn("pt-0.5 transition", !selectedIds.size && "opacity-0 group-hover:opacity-100 focus-within:opacity-100")}>
              <Checkbox checked={selectedIds.has(entry.id)} onCheckedChange={(checked) => onToggleSelect(entry.id, checked === true)} aria-label={`${tx(locale, "Select", "Выбрать")} ${entry.name}`} />
            </span>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            {formatMoney(entry.amount, entry.currency)}
            <span className="ml-1 text-xs font-normal text-subtle-foreground">{billingText(entry, locale)}</span>
          </p>
          <StatusPill status={status} days={days} locale={locale} />
        </div>

        {chips.length ? (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((field) => <CopyChip key={field.id} label={field.label} value={String(entry.customFields[field.id])} />)}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <span className="truncate">{entry.billingEndAt ? `${tx(locale, "Renews", "Продление")} ${displayDate(entry.billingEndAt)}` : tx(locale, "No renewal date", "Нет даты продления")}</span>
          {renderActions(entry, true)}
        </div>
      </article>
    );
  }

  function renderListRow(entry: EntryView) {
    const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
    const { status, days } = statusById.get(entry.id)!;
    return (
      <div
        key={entry.id}
        role="button"
        tabIndex={0}
        onClick={() => setOpenId(entry.id)}
        onKeyDown={(event) => { if (event.key === "Enter") setOpenId(entry.id); }}
        className={cn(
          "group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(9.5rem,1fr)_minmax(6.5rem,auto)_auto]",
          selectedIds.has(entry.id) && "bg-violet-500/[0.05]",
        )}
      >
        <span className="flex items-center gap-2.5">
          {!readOnly ? (
            <span onClick={(event) => event.stopPropagation()}>
              <Checkbox checked={selectedIds.has(entry.id)} onCheckedChange={(checked) => onToggleSelect(entry.id, checked === true)} aria-label={`${tx(locale, "Select", "Выбрать")} ${entry.name}`} className="h-3.5 w-3.5 rounded-[4px] [&_svg]:h-2.5 [&_svg]:w-2.5" />
            </span>
          ) : null}
          <span className={cn("h-2 w-2 rounded-full", STATUS_STYLE[status].dot)} title={statusLabel(status, locale)} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{entry.name}</span>
            {showCategory && group !== "category" && category ? (
              <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex" style={{ color: category.color || undefined }}>
                <AppIcon name={category.icon} className="h-3 w-3" />{category.name}
              </span>
            ) : null}
          </span>
          {entry.notes ? <span className="block truncate text-xs text-subtle-foreground">{entry.notes.replace(/<[^>]+>/g, "")}</span> : null}
        </span>
        <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
          {[entry.vendorName || (entry.vendorUrl ? hostLabel(entry.vendorUrl) : ""), entry.accountName].filter(Boolean).join(" · ") || "—"}
        </span>
        <span className={cn("hidden min-w-0 truncate whitespace-nowrap text-xs md:block", STATUS_STYLE[status].text)}>
          {entry.billingEndAt ? `${displayDate(entry.billingEndAt)} · ${dueText(status, days, locale)}` : "—"}
        </span>
        <span className="whitespace-nowrap text-right text-sm font-semibold text-foreground">
          {formatMoney(entry.amount, entry.currency)}
          <span className="ml-1 hidden text-xs font-normal text-subtle-foreground lg:inline">{billingText(entry, locale)}</span>
        </span>
        <span className="hidden md:block">{renderActions(entry, true)}</span>
      </div>
    );
  }

  const openCategory = open?.categoryId ? categoryById.get(open.categoryId) : undefined;
  const openStatus = open ? statusById.get(open.id)! : null;

  return (
    <>
      <div className="space-y-6">
        {visibleGroups.map(({ shown, ...bucket }) => {
          const total = group !== "none" ? groupTotal(bucket) : null;
          return (
            <section key={bucket.key} className="space-y-2.5">
              {group !== "none" ? (
                <header className="flex items-center gap-2 px-1">
                  {bucket.icon ? <AppIcon name={bucket.icon} className="h-4 w-4" /> : group === "status" ? <span className={cn("h-2 w-2 rounded-full", STATUS_STYLE[bucket.key as EntryStatus].dot)} /> : null}
                  <h3 className="text-sm font-semibold text-foreground" style={{ color: bucket.color || undefined }}>{bucket.label}</h3>
                  <Badge variant="secondary" className="px-2 py-0">{bucket.entries.length}</Badge>
                  {total ? <span className="text-xs text-subtle-foreground">{total}</span> : null}
                </header>
              ) : null}
              {layout === "cards" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{shown.map(renderCard)}</div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{shown.map(renderListRow)}</div>
              )}
            </section>
          );
        })}
        {entries.length > visibleCount ? (
          <div className="flex justify-center">
            <Button type="button" variant="secondary" size="sm" onClick={() => setVisibleCount((count) => count + 60)}>
              {tx(locale, `Show more (${entries.length - visibleCount} left)`, `Показать ещё (осталось ${entries.length - visibleCount})`)}
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        {open && openStatus ? (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AppIcon name={openCategory?.icon || "Circle"} className="h-4 w-4" />
                <span className="truncate">{open.name}</span>
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <StatusPill status={openStatus.status} days={openStatus.days} locale={locale} />
                <span>{formatMoney(open.amount, open.currency)} {billingText(open, locale)}</span>
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                [tx(locale, "Category", "Категория"), openCategory?.name || tx(locale, "Uncategorized", "Без категории")],
                [tx(locale, "Vendor", "Поставщик"), open.vendorName || "—"],
                [tx(locale, "Account", "Аккаунт"), open.accountName || "—"],
                [tx(locale, "Dates", "Даты"), `${open.billingStartAt ? displayDate(open.billingStartAt) : "—"} → ${open.billingEndAt ? displayDate(open.billingEndAt) : "—"}`],
                ...(openCategory?.fields || []).map((field) => [
                  field.label,
                  field.type === "checkbox" ? (open.customFields[field.id] ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет")) : String(open.customFields[field.id] ?? "") || "—",
                ]),
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 break-words text-foreground">{value}</dd>
                </div>
              ))}
              {open.vendorUrl ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">URL</dt>
                  <dd className="mt-0.5"><a href={open.vendorUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-sky-300 hover:text-sky-200">{open.vendorUrl}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a></dd>
                </div>
              ) : null}
              {open.notes ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">{tx(locale, "Notes", "Заметки")}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{open.notes.replace(/<[^>]+>/g, "")}</dd>
                </div>
              ) : null}
            </dl>
            {!readOnly ? (
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { onEditInGrid(open.id); setOpenId(null); }}>
                  {tx(locale, "Edit inline", "Править в таблице")}
                </Button>
                <Button asChild>
                  <Link href={`/app/items/${open.id}?workspace=${workspaceId}`}>
                    <PencilLine className="h-4 w-4" />{tx(locale, "Open full form", "Открыть форму")}
                  </Link>
                </Button>
              </DialogFooter>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
