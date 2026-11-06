"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PaymentItem } from "@/lib/types";
import { cn, displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { titleWithHost } from "@/lib/item-host";
import { AppIcon } from "./icons";
import { DashboardUpcomingActions } from "./dashboard-upcoming-actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type UpcomingItem = PaymentItem & {
  nextPaymentAt: string;
  daysUntilPayment: number;
  /** The amount converted to the display currency. */
  displayAmount?: number;
};

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

function relativeDays(days: number, locale: Locale) {
  if (locale === "ru") {
    if (days < 0) return `${Math.abs(days)} дн. просрочено`;
    if (days === 0) return "сегодня";
    return `~${days} дн.`;
  }
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "~1 day";
  return `~${days} days`;
}

function vendorHref(url: string) {
  const normalized = url.trim();
  if (!normalized) return "";
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

function billingLabel(item: UpcomingItem, locale: Locale) {
  if (item.paymentType !== "recurring") return tx(locale, "Single payment", "Разовый платёж");
  const label = periodLabel(item.period, item.customPeriodDays);
  if (locale !== "ru") return label;
  if (item.period === "7d") return "7 дней";
  if (item.period === "1m") return "1 месяц";
  if (item.period === "3m") return "3 месяца";
  if (item.period === "1y") return "1 год";
  if (item.period === "custom") return `${item.customPeriodDays || 30} дней`;
  return label;
}

/** Server IP or domain (Servers and Domains only), unless the name already holds it. */
function hostLine(item: UpcomingItem) {
  return titleWithHost(item.name, item.host) === item.name ? "" : item.host || "";
}

function DetailValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">{label}</p>
      <div className="mt-1 truncate text-[13px] text-foreground">{children}</div>
    </div>
  );
}

/** Amount in the display currency, with the entry's own amount underneath when it is in another currency. */
function Amount({ item, displayCurrency }: { item: UpcomingItem; displayCurrency: string }) {
  const converted = item.currency !== displayCurrency && item.displayAmount !== undefined;
  return (
    <>
      <span className="block font-semibold tabular-nums text-white">{formatMoney(converted ? item.displayAmount! : item.amount, converted ? displayCurrency : item.currency)}</span>
      {converted ? <span className="mt-0.5 block text-[11.5px] tabular-nums text-zinc-500">{formatMoney(item.amount, item.currency)}</span> : null}
    </>
  );
}

export function DashboardUpcomingTable({
  items,
  workspaceId,
  displayCurrency,
  locale,
}: {
  items: UpcomingItem[];
  workspaceId: number;
  displayCurrency: string;
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [whenFilter, setWhenFilter] = useState<"all" | "overdue" | "week">("all");

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((item) => seen.set(String(item.categoryId ?? "none"), item.categoryName || t(locale, "uncategorized")));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items, locale]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && String(item.categoryId ?? "none") !== categoryFilter) return false;
      if (whenFilter === "overdue" && item.daysUntilPayment >= 0) return false;
      if (whenFilter === "week" && (item.daysUntilPayment < 0 || item.daysUntilPayment > 7)) return false;
      if (!needle) return true;
      return [titleWithHost(item.name, item.host), item.host, item.vendorName, item.accountName, item.categoryName, item.vendorUrl].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [categoryFilter, items, query, whenFilter]);
  const filtering = Boolean(query.trim()) || categoryFilter !== "all" || whenFilter !== "all";
  const emptyText = filtering
    ? tx(locale, "Nothing matches these filters.", "Ничего не найдено по фильтрам.")
    : tx(locale, "No payments due in the next 2 weeks.", "Платежей в ближайшие 2 недели нет.");

  function toggle(itemId: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function disclosure(item: UpcomingItem, className = "h-6 w-6") {
    const isExpanded = expanded.has(item.id);
    const label = isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали");
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        onClick={() => toggle(item.id)}
        title={label}
        aria-label={`${label}: ${item.name}`}
        aria-expanded={isExpanded}
      >
        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  function details(item: UpcomingItem) {
    const url = vendorHref(item.vendorUrl);
    const notes = item.notes.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailValue label={tx(locale, "Billing", "Оплата")}>{billingLabel(item, locale)}</DetailValue>
        <DetailValue label={tx(locale, "Billing range", "Период действия")}>
          {displayDate(item.billingStartAt)} → {displayDate(item.billingEndAt)}
        </DetailValue>
        <DetailValue label={tx(locale, "Vendor URL", "Сайт поставщика")}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-200 hover:text-violet-100">
              <span className="truncate">{item.vendorUrl}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : "—"}
        </DetailValue>
        <DetailValue label={tx(locale, "Notes", "Заметки")}>{notes || "—"}</DetailValue>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 md:px-5">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tx(locale, "Search name, IP, domain, vendor…", "Поиск по названию, IP, домену, вендору…")}
            aria-label={tx(locale, "Search upcoming payments", "Поиск по ближайшим платежам")}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <NativeSelect value={categoryFilter} onChange={setCategoryFilter} ariaLabel={t(locale, "category")} className="h-8 w-auto min-w-[9rem] [&_select]:text-[13px]">
          <option value="all">{tx(locale, "All categories", "Все категории")}</option>
          {categoryOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </NativeSelect>
        <NativeSelect value={whenFilter} onChange={(value) => setWhenFilter(value as typeof whenFilter)} ariaLabel={tx(locale, "Due", "Срок")} className="h-8 w-auto min-w-[8rem] [&_select]:text-[13px]">
          <option value="all">{tx(locale, "Any date", "Любая дата")}</option>
          <option value="overdue">{tx(locale, "Overdue", "Просрочено")}</option>
          <option value="week">{tx(locale, "Next 7 days", "Ближайшие 7 дней")}</option>
        </NativeSelect>
        <span className="text-xs text-zinc-500">{filtering ? `${visible.length} / ${items.length}` : items.length}</span>
      </div>
      <div className="space-y-2 p-3 md:hidden">
        {visible.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-start gap-2 p-3">
              {disclosure(item)}
              <div className="min-w-0 flex-1">
                <h3 className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
                  <span className="shrink-0" style={{ color: item.categoryColor || undefined }}><AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" /></span>
                  <span className="truncate">{item.name}</span>
                </h3>
                {hostLine(item) ? <p className="mt-0.5 font-mono text-[11.5px] text-zinc-500">{hostLine(item)}</p> : null}
                <p className={cn("mt-1.5 text-xs", item.daysUntilPayment < 0 ? "text-red-300" : "text-zinc-400")}>
                  {relativeDays(item.daysUntilPayment, locale)} <span className="text-zinc-500">· {displayDate(item.nextPaymentAt)}</span>
                </p>
              </div>
              <div className="shrink-0 text-right text-sm"><Amount item={item} displayCurrency={displayCurrency} /></div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] px-3 py-2">
              <span className="min-w-0 truncate text-xs text-zinc-500">{[item.vendorName, item.accountName].filter(Boolean).join(" · ") || "—"}</span>
              <DashboardUpcomingActions workspaceId={item.workspaceId || workspaceId} itemId={item.id} itemName={item.name} amountLabel={formatMoney(item.amount, item.currency)} locale={locale} />
            </div>
            {expanded.has(item.id) ? <div className="border-t border-border bg-surface p-3">{details(item)}</div> : null}
          </article>
        ))}
        {!visible.length ? <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p> : null}
      </div>

      {/* Fixed column widths so names truncate to one line instead of pushing the table sideways. */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-11" />
            <col />
            <col className="w-[9.5rem]" />
            <col className="w-[22%]" />
            <col className="w-[7.5rem]" />
            <col className="w-[6.5rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-0"><span className="sr-only">{tx(locale, "Details", "Детали")}</span></TableHead>
              <TableHead>{tx(locale, "Name", "Название")}</TableHead>
              <TableHead>{tx(locale, "Due", "Срок")}</TableHead>
              <TableHead>{tx(locale, "Vendor · account", "Поставщик · аккаунт")}</TableHead>
              <TableHead className="text-right">{t(locale, "amount")}</TableHead>
              <TableHead><span className="sr-only">{t(locale, "actions")}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <Fragment key={item.id}>
                <TableRow className="group">
                  <TableCell className="px-0 py-2 text-center">{disclosure(item)}</TableCell>
                  <TableCell className="py-2.5" title={item.categoryName || undefined}>
                    <span className="flex min-w-0 items-center gap-2 font-medium text-white">
                      <span className="shrink-0" style={{ color: item.categoryColor || undefined }}><AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" /></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    {hostLine(item) ? <span className="mt-0.5 block truncate pl-[22px] font-mono text-[11.5px] text-zinc-500">{hostLine(item)}</span> : null}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className={cn("block truncate", item.daysUntilPayment < 0 ? "text-red-300" : "text-zinc-200")}>{relativeDays(item.daysUntilPayment, locale)}</span>
                    <span className="mt-0.5 block text-[11.5px] text-zinc-500">{displayDate(item.nextPaymentAt)}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {item.vendorName ? (
                      vendorHref(item.vendorUrl) ? (
                        <a href={vendorHref(item.vendorUrl)} target="_blank" rel="noreferrer" className="block truncate text-zinc-200 transition hover:text-white">
                          {item.vendorName}
                        </a>
                      ) : <span className="block truncate text-zinc-200">{item.vendorName}</span>
                    ) : <span className="text-zinc-500">—</span>}
                    {item.accountName ? <span className="mt-0.5 block truncate text-[11.5px] text-zinc-500" title={item.accountName}>{item.accountName}</span> : null}
                  </TableCell>
                  <TableCell className="py-2.5 text-right"><Amount item={item} displayCurrency={displayCurrency} /></TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                      <DashboardUpcomingActions
                        workspaceId={item.workspaceId || workspaceId}
                        itemId={item.id}
                        itemName={item.name}
                        amountLabel={formatMoney(item.amount, item.currency)}
                        locale={locale}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(item.id) ? (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-white/[0.015] py-3 pl-14">{details(item)}</TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
            {!visible.length ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-zinc-500">{emptyText}</TableCell></TableRow>
            ) : null}
          </TableBody>
        </table>
      </div>
    </>
  );
}
