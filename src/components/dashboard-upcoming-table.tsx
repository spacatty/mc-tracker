"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { CalendarCheck, CircleHelp, SearchX } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { count, t } from "@/lib/i18n";
import type { Category, PaymentItem, VendorSuggestion } from "@/lib/types";
import { cn, displayDate, formatMoney } from "@/lib/utils";
import { titleWithHost } from "@/lib/item-host";
import { CategoryMark, CopyHost, VendorAccount } from "./host-line";
import { DashboardUpcomingActions } from "./dashboard-upcoming-actions";
import { EntryInspector } from "./inspector/entry-inspector";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/empty-state";
import { SearchInput } from "./ui/input";
import { FilterSelect } from "./ui/filter-select";
import { Tooltip } from "./ui/tooltip";
import { SectionCard } from "./ui/section-card";
import { Table, TableBody, TableCell, TableEmpty, TableFooter, TableHead, TableHeader, TableRow, TableToolbar } from "./ui/table";

type UpcomingItem = PaymentItem & {
  nextPaymentAt: string;
  daysUntilPayment: number;
  /** The amount converted to the display currency. */
  displayAmount?: number;
};

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

/** Red when overdue, amber within three days, neutral otherwise. */
function dueTone(days: number) {
  if (days < 0) return "text-red-300";
  if (days <= 3) return "text-amber-300";
  return "text-zinc-200";
}

function relativeDays(days: number, locale: Locale) {
  if (locale === "ru") {
    if (days < 0) return `просрочено на ${Math.abs(days)} дн.`;
    if (days === 0) return "сегодня";
    return `через ${days} дн.`;
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

/** Server IP or domain (Servers and Domains only), unless the name already holds it. */
function hostLine(item: UpcomingItem) {
  return titleWithHost(item.name, item.host) === item.name ? "" : item.host || "";
}

/** Amount in the display currency, with the entry's own amount underneath when it is in another currency. */
function Amount({ item, displayCurrency, locale }: { item: UpcomingItem; displayCurrency: string; locale: Locale }) {
  const converted = item.currency !== displayCurrency && item.displayAmount !== undefined;
  const value = formatMoney(converted ? item.displayAmount! : item.amount, converted ? displayCurrency : item.currency);
  // The display-currency figure (what the total adds up); the entry's own price sits behind (?) when it differs.
  return (
    <span className={cn("flex w-full items-center gap-2 whitespace-nowrap tabular-nums", converted ? "justify-between" : "justify-end")}>
      {converted ? (
        <Tooltip label={tx(locale, `Billed as ${formatMoney(item.amount, item.currency)}`, `Оплачивается как ${formatMoney(item.amount, item.currency)}`)}>
          <span
            tabIndex={0}
            onClick={(event) => event.stopPropagation()}
            aria-label={tx(locale, `Billed as ${formatMoney(item.amount, item.currency)}`, `Оплачивается как ${formatMoney(item.amount, item.currency)}`)}
            className="inline-grid shrink-0 cursor-help place-items-center rounded-full text-zinc-600 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </Tooltip>
      ) : null}
      <span className="font-medium text-zinc-100">{value}</span>
    </span>
  );
}

/** What the entry drawer needs for each workspace an upcoming entry belongs to. */
export type UpcomingWorkspaceContext = { categories: Category[]; vendorSuggestions: VendorSuggestion[]; readOnly: boolean };

/** How far ahead the dashboard loads upcoming dates; the period selector narrows within it. */
export const UPCOMING_HORIZON_DAYS = 90;

type Period = "overdue" | "today" | "7" | "14" | "30" | "90";
const PERIODS: readonly Period[] = ["overdue", "today", "7", "14", "30", "90"];

/** Overdue entries stay in every window; "overdue" shows only them. */
function inPeriod(days: number, period: Period) {
  if (period === "overdue") return days < 0;
  if (period === "today") return days <= 0;
  return days <= Number(period);
}

function periodDescription(period: Period, locale: Locale) {
  if (period === "overdue") return tx(locale, "Overdue only", "Только просроченные");
  if (period === "today") return tx(locale, "Due today", "На сегодня");
  return tx(locale, `Next ${period} days`, `Ближайшие ${period} дн.`);
}

export function DashboardUpcomingTable({
  items,
  workspaceId,
  displayCurrency,
  contexts,
  locale,
  headerActions,
}: {
  items: UpcomingItem[];
  workspaceId: number;
  displayCurrency: string;
  contexts: Record<number, UpcomingWorkspaceContext>;
  locale: Locale;
  /** Top-right of the card header (the workspace scope switch). */
  headerActions?: ReactNode;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [period, setPeriod] = useState<Period>("14");

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { name: string; icon?: string; color?: string; count: number }>();
    items.forEach((item) => {
      if (!inPeriod(item.daysUntilPayment, period)) return;
      const key = String(item.categoryId ?? "none");
      const entry = seen.get(key) || { name: item.categoryName || t(locale, "uncategorized"), icon: item.categoryIcon, color: item.categoryColor, count: 0 };
      entry.count += 1;
      seen.set(key, entry);
    });
    return [...seen.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [items, locale, period]);

  // Search and category first, so the due-filter counts reflect them.
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && String(item.categoryId ?? "none") !== categoryFilter) return false;
      if (!needle) return true;
      return [titleWithHost(item.name, item.host), item.host, item.vendorName, item.accountName, item.categoryName, item.vendorUrl].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [categoryFilter, items, query]);
  const visible = useMemo(() => matching.filter((item) => inPeriod(item.daysUntilPayment, period)), [matching, period]);
  const periodTotals = useMemo(
    () =>
      Object.fromEntries(
        PERIODS.map((candidate) => [
          candidate,
          matching.filter((item) => inPeriod(item.daysUntilPayment, candidate)).reduce((sum, item) => sum + (item.displayAmount ?? item.amount), 0),
        ]),
      ) as Record<Period, number>,
    [matching],
  );
  const overdueVisible = visible.filter((item) => item.daysUntilPayment < 0).length;
  const total = visible.reduce((sum, item) => sum + (item.displayAmount ?? item.amount), 0);
  const filtering = Boolean(query.trim()) || categoryFilter !== "all";
  const openItem = openId ? items.find((item) => item.id === openId) || null : null;
  const openIndex = openItem ? visible.findIndex((item) => item.id === openItem.id) : -1;
  const openContext = openItem ? contexts[openItem.workspaceId || workspaceId] : undefined;
  const navigate = useCallback((direction: 1 | -1) => {
    if (!visible.length) return;
    const nextIndex = openIndex < 0 ? 0 : (openIndex + direction + visible.length) % visible.length;
    setOpenId(visible[nextIndex].id);
  }, [openIndex, visible]);
  /** Row/card click opens the drawer, unless the click landed on a control inside it. */
  const openFrom = (event: MouseEvent, item: UpcomingItem) => {
    if ((event.target as HTMLElement).closest("button, a, input, select, textarea, [role=menu], [role=dialog]")) return;
    setOpenId(item.id);
  };
  const openFromKey = (event: KeyboardEvent, item: UpcomingItem) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpenId(item.id);
    }
  };
  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
  };
  const emptyTitle = filtering
    ? tx(locale, "Nothing matches these filters", "По этим фильтрам ничего не найдено")
    : period === "overdue"
      ? tx(locale, "Nothing is overdue", "Просроченных нет")
      : tx(locale, "Nothing due in this period", "В этом периоде платежей нет");
  const emptyIcon = filtering ? <SearchX /> : <CalendarCheck />;
  const emptyAction = filtering ? (
    <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
      {tx(locale, "Clear filters", "Сбросить фильтры")}
    </Button>
  ) : undefined;

  function actions(item: UpcomingItem) {
    return (
      <DashboardUpcomingActions
        workspaceId={item.workspaceId || workspaceId}
        itemId={item.id}
        itemName={item.name}
        amountLabel={formatMoney(item.amount, item.currency)}
        vendorUrl={vendorHref(item.vendorUrl) || undefined}
        canQuickLogin={Boolean(item.vendorName || item.accountName)}
        locale={locale}
      />
    );
  }

  function categoryIcon(item: UpcomingItem) {
    return <CategoryMark category={{ name: item.categoryName, icon: item.categoryIcon, color: item.categoryColor }} />;
  }

  const totalLine = (
    <>
      <span className="text-zinc-300">{count(locale, visible.length, { one: "entry", other: "entries", ru: ["запись", "записи", "записей"] })}</span>
      {overdueVisible ? <span className="text-red-300/90"> · {tx(locale, `${overdueVisible} overdue`, `просрочено: ${overdueVisible}`)}</span> : null}
    </>
  );

  return (
    <>
      <SectionCard
        flush
        aria-label={tx(locale, "Upcoming dates", "Ближайшие даты")}
        className="flex min-h-[24rem] flex-col xl:min-h-0"
        bodyClassName="flex min-h-0 flex-1 flex-col"
      >
      <TableToolbar>
        <SearchInput
          size="sm"
          value={query}
          onChange={setQuery}
          placeholder={tx(locale, "Search name, IP, domain, vendor…", "Поиск по названию, IP, домену, поставщику…")}
          aria-label={tx(locale, "Search upcoming payments", "Поиск по ближайшим платежам")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="min-w-[12rem] max-w-sm flex-1"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect<string>
            ariaLabel={t(locale, "category")}
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "all", label: tx(locale, "All categories", "Все категории"), meta: categoryOptions.reduce((sum, [, entry]) => sum + entry.count, 0) },
              ...categoryOptions.map(([id, entry], index) => ({
                value: id,
                label: entry.name,
                icon: <CategoryMark category={{ name: entry.name, icon: entry.icon, color: entry.color }} className="h-4 w-4 rounded" />,
                meta: entry.count,
                separated: index === 0,
              })),
            ]}
          />
          <FilterSelect<Period>
            ariaLabel={tx(locale, "Period", "Период")}
            value={period}
            onChange={setPeriod}
            contentClassName="min-w-[16rem]"
            options={PERIODS.map((candidate) => ({
              value: candidate,
              label: periodDescription(candidate, locale),
              meta: formatMoney(periodTotals[candidate] || 0, displayCurrency),
              separated: candidate === "7",
            }))}
          />
          {headerActions}
        </div>
      </TableToolbar>

      {/* Mobile: cards; a tap anywhere outside the controls opens the drawer. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
        <div className="space-y-2">
        {visible.map((item) => (
          <article
            key={item.id}
            data-entry-row
            tabIndex={0}
            aria-label={item.name}
            onClick={(event) => openFrom(event, item)}
            onKeyDown={(event) => openFromKey(event, item)}
            className={cn(
              "group cursor-pointer overflow-hidden rounded-lg border bg-white/[0.02] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
              openId === item.id ? "border-violet-400/30" : "border-white/[0.06]",
            )}
          >
            <div className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-zinc-100">
                  {categoryIcon(item)}
                  <span className="truncate">{item.name}</span>
                </h3>
                {hostLine(item) ? (
                  <div className="pl-[22px]">
                    <CopyHost value={hostLine(item)} locale={locale} />
                  </div>
                ) : null}
                <p className="mt-1.5 text-xs tabular-nums">
                  <span className={dueTone(item.daysUntilPayment)}>{relativeDays(item.daysUntilPayment, locale)}</span>
                  <span className="text-zinc-500"> · {displayDate(item.nextPaymentAt)}</span>
                </p>
              </div>
              <div className="shrink-0 text-right text-[13px]">
                <Amount item={item} displayCurrency={displayCurrency} locale={locale} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-1.5">
              <VendorAccount vendor={item.vendorName} account={item.accountName} className="text-[11.5px]" />
              {actions(item)}
            </div>
          </article>
        ))}
        {!visible.length ? <EmptyState compact icon={emptyIcon} title={emptyTitle} action={emptyAction} /> : null}
        </div>
        {visible.length ? (
          <div className="sticky -bottom-3 -mx-3 -mb-3 mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] bg-surface px-4 py-2.5 text-xs text-zinc-500">
            <span>{totalLine}</span>
            <span className="font-semibold tabular-nums text-zinc-100">{formatMoney(total, displayCurrency)}</span>
          </div>
        ) : null}
      </div>

      {/* Fixed column widths so names truncate to one line instead of pushing the table sideways. */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <Table bare fill className={cn("table-fixed", visible.length > 0 && "mc-table-with-spacer")}>
          <colgroup>
            <col />
            <col className="w-[18%]" />
            <col className="w-[10.5rem]" />
            <col className="w-[17%]" />
            <col className="w-[7.5rem]" />
            <col className="w-[7.5rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>{tx(locale, "Name", "Название")}</TableHead>
              <TableHead>{tx(locale, "Identifier", "Идентификатор")}</TableHead>
              <TableHead>{tx(locale, "Due", "Срок")}</TableHead>
              <TableHead>{tx(locale, "Vendor", "Поставщик")}</TableHead>
              <TableHead align="right">{t(locale, "amount")}</TableHead>
              <TableHead align="right">
                <span className="sr-only">{t(locale, "actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <TableRow
                key={item.id}
                interactive
                active={openId === item.id}
                data-entry-row
                tabIndex={0}
                aria-label={item.name}
                onClick={(event) => openFrom(event, item)}
                onKeyDown={(event) => openFromKey(event, item)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400/40"
              >
                <TableCell primary title={item.categoryName || undefined}>
                  <span className="flex min-w-0 items-center gap-2">
                    {categoryIcon(item)}
                    <span className="truncate">{item.name}</span>
                  </span>
                </TableCell>
                <TableCell>{hostLine(item) ? <CopyHost value={hostLine(item)} locale={locale} className="mt-0 max-w-full" /> : <span className="text-zinc-700">—</span>}</TableCell>
                <TableCell className="tabular-nums">
                  <span className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className={cn("truncate", dueTone(item.daysUntilPayment))}>{relativeDays(item.daysUntilPayment, locale)}</span>
                    <Tooltip label={displayDate(item.nextPaymentAt)}>
                      <span
                        tabIndex={0}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`${tx(locale, "Due date", "Срок оплаты")}: ${displayDate(item.nextPaymentAt)}`}
                        className="inline-grid shrink-0 cursor-help place-items-center rounded-full text-zinc-600 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                      >
                        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </Tooltip>
                  </span>
                </TableCell>
                <TableCell>
                  <VendorAccount vendor={item.vendorName} account={item.accountName} />
                </TableCell>
                <TableCell align="right" className="pr-5">
                  <Amount item={item} displayCurrency={displayCurrency} locale={locale} />
                </TableCell>
                <TableCell align="right" className="whitespace-nowrap">
                  {actions(item)}
                </TableCell>
              </TableRow>
            ))}
            {!visible.length ? <TableEmpty colSpan={6} icon={emptyIcon} title={emptyTitle} action={emptyAction} /> : null}
            {visible.length ? (
              <tr data-spacer aria-hidden="true">
                <td colSpan={6} />
              </tr>
            ) : null}
          </TableBody>
          {visible.length ? (
            <TableFooter sticky>
              <TableRow>
                {/* One cell per column, so the Sheet style's column lines run through the totals row. */}
                <TableCell className="truncate whitespace-nowrap text-xs text-zinc-300">{count(locale, visible.length, { one: "entry", other: "entries", ru: ["запись", "записи", "записей"] })}</TableCell>
                <TableCell />
                <TableCell className="whitespace-nowrap text-xs text-red-300/90">{overdueVisible ? tx(locale, `${overdueVisible} overdue`, `просрочено: ${overdueVisible}`) : null}</TableCell>
                <TableCell />
                <TableCell align="right" className="whitespace-nowrap pr-5 font-semibold tabular-nums text-zinc-100">{formatMoney(total, displayCurrency)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      </SectionCard>

      {openItem && openContext ? (
        <EntryInspector
          key={openItem.id}
          item={openItem}
          categories={openContext.categories}
          vendorSuggestions={openContext.vendorSuggestions}
          workspaceId={openItem.workspaceId || workspaceId}
          readOnly={openContext.readOnly}
          locale={locale}
          position={openIndex >= 0 ? { index: openIndex, total: visible.length } : null}
          onClose={() => setOpenId(null)}
          onNavigate={navigate}
        />
      ) : null}
    </>
  );
}
