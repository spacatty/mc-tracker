"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Search } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PaymentItem } from "@/lib/types";
import { displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { titleWithHost } from "@/lib/item-host";
import { AppIcon } from "./icons";
import { DashboardUpcomingActions } from "./dashboard-upcoming-actions";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type UpcomingItem = PaymentItem & {
  nextPaymentAt: string;
  daysUntilPayment: number;
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

/** Entry name with its server IP or domain muted after it, e.g. "Main Offer (sample.com)". */
function ItemTitle({ item }: { item: UpcomingItem }) {
  const full = titleWithHost(item.name, item.host);
  if (full === item.name) return <>{item.name}</>;
  return (
    <>
      {item.name} <span className="font-normal text-zinc-400">({item.host})</span>
    </>
  );
}

function DetailValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">{label}</p>
      <div className="mt-1 truncate text-[13px] text-foreground">{children}</div>
    </div>
  );
}

export function DashboardUpcomingTable({
  items,
  workspaceId,
  locale,
}: {
  items: UpcomingItem[];
  workspaceId: number;
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
      <div className="h-[420px] space-y-3 overflow-y-auto p-3 md:hidden">
        {visible.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="p-3">
              <div className="flex items-start gap-2">
                {disclosure(item)}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground" title={titleWithHost(item.name, item.host)}><ItemTitle item={item} /></h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.vendorName || "—"} · {item.accountName || "—"}</p>
                </div>
                <DashboardUpcomingActions workspaceId={item.workspaceId || workspaceId} itemId={item.id} itemName={titleWithHost(item.name, item.host)} amountLabel={formatMoney(item.amount, item.currency)} locale={locale} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 pl-8">
                <div>
                  <Badge className="gap-1.5" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}18`, color: item.categoryColor || "#c4b5fd" }}>
                    <AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" />
                    {item.categoryName || t(locale, "uncategorized")}
                  </Badge>
                  <p className="mt-2 text-xs text-muted-foreground">{t(locale, "paymentDate")}: {displayDate(item.nextPaymentAt)}</p>
                </div>
                <p className="text-right font-semibold text-foreground">{formatMoney(item.amount, item.currency)}</p>
              </div>
            </div>
            {expanded.has(item.id) ? <div className="border-t border-border bg-surface p-3">{details(item)}</div> : null}
          </article>
        ))}
        {!visible.length ? <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p> : null}
      </div>

      {/* Fixed height so a long list scrolls inside the card; the header stays pinned. */}
      <div className="hidden h-[420px] overflow-auto md:block">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-surface">
            <TableRow>
              <TableHead className="w-12 px-0 text-center first:pl-0"><span className="sr-only">{tx(locale, "Details", "Детали")}</span></TableHead>
              <TableHead>{tx(locale, "Name", "Название")}</TableHead>
              <TableHead className="text-center">{tx(locale, "Payment date", "Дата оплаты")}</TableHead>
              <TableHead className="text-center">{t(locale, "category")}</TableHead>
              <TableHead>{tx(locale, "Vendor", "Вендор")}</TableHead>
              <TableHead>{tx(locale, "Account", "Аккаунт")}</TableHead>
              <TableHead className="text-right">{t(locale, "amount")}</TableHead>
              <TableHead className="text-right">{t(locale, "actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <Fragment key={item.id}>
                <TableRow className="group">
                  <TableCell className="w-12 px-0 py-2 text-center first:pl-0">{disclosure(item)}</TableCell>
                  <TableCell className="font-medium text-white"><ItemTitle item={item} /></TableCell>
                  <TableCell className="whitespace-nowrap text-center text-zinc-300">
                    {relativeDays(item.daysUntilPayment, locale)} <span className="text-zinc-500">({displayDate(item.nextPaymentAt)})</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="gap-1.5" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}18`, color: item.categoryColor || "#c4b5fd" }}>
                      <AppIcon name={item.categoryIcon} className="h-3 w-3" />
                      {item.categoryName || t(locale, "uncategorized")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-white">
                    {item.vendorName ? (
                      vendorHref(item.vendorUrl) ? (
                        <a href={vendorHref(item.vendorUrl)} target="_blank" rel="noreferrer" className="underline decoration-zinc-600 hover:decoration-violet-300">
                          {item.vendorName}
                        </a>
                      ) : item.vendorName
                    ) : <span className="text-zinc-500">—</span>}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-zinc-300" title={item.accountName || undefined}>{item.accountName || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-white">{formatMoney(item.amount, item.currency)}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end">
                    <DashboardUpcomingActions
                      workspaceId={item.workspaceId || workspaceId}
                      itemId={item.id}
                      itemName={titleWithHost(item.name, item.host)}
                      amountLabel={formatMoney(item.amount, item.currency)}
                      locale={locale}
                    />
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(item.id) ? (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-white/[0.015] py-3 pl-16">{details(item)}</TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
            {!visible.length ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-zinc-500">{emptyText}</TableCell></TableRow>
            ) : null}
          </TableBody>
        </table>
      </div>
    </>
  );
}
