"use client";

import { Fragment, useCallback, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown, ChevronUp, Copy, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { Category, PaymentItem, VendorSuggestion } from "@/lib/types";
import { cn, displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { titleWithHost } from "@/lib/item-host";
import { AppIcon } from "./icons";
import { DashboardUpcomingActions } from "./dashboard-upcoming-actions";
import { EntryInspector } from "./inspector/entry-inspector";
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

/** What the entry drawer needs for each workspace an upcoming entry belongs to. */
export type UpcomingWorkspaceContext = { categories: Category[]; vendorSuggestions: VendorSuggestion[]; readOnly: boolean };

/** Copies text, falling back to a hidden textarea where the Clipboard API is blocked (some embedded browsers). */
async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** The IP or domain under a name: click copies it (without opening the drawer); a clipboard icon shows on hover. */
function CopyHost({ value, kind, locale }: { value: string; kind: "IP" | "domain"; locale: Locale }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copyToClipboard(value).then((ok) =>
          ok
            ? toast(kind === "IP" ? tx(locale, "IP copied", "IP скопирован") : tx(locale, "Domain copied", "Домен скопирован"))
            : toast.error(tx(locale, "Could not copy", "Не удалось скопировать")),
        );
      }}
      title={tx(locale, `Copy ${kind}`, `Копировать ${kind === "IP" ? "IP" : "домен"}`)}
      className="group/copy mt-0.5 inline-flex max-w-full items-center gap-1 rounded px-1 -mx-1 font-mono text-[11.5px] text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
    >
      <span className="truncate">{value}</span>
      <Copy className="h-3 w-3 shrink-0 opacity-0 transition group-hover/copy:opacity-100 group-focus-visible/copy:opacity-100" />
    </button>
  );
}

export function DashboardUpcomingTable({
  items,
  workspaceId,
  displayCurrency,
  contexts,
  locale,
}: {
  items: UpcomingItem[];
  workspaceId: number;
  displayCurrency: string;
  contexts: Record<number, UpcomingWorkspaceContext>;
  locale: Locale;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
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
  const openItem = openId ? items.find((item) => item.id === openId) || null : null;
  const openIndex = openItem ? visible.findIndex((item) => item.id === openItem.id) : -1;
  const openContext = openItem ? contexts[openItem.workspaceId || workspaceId] : undefined;
  const navigate = useCallback((direction: 1 | -1) => {
    if (!visible.length) return;
    const nextIndex = openIndex < 0 ? 0 : (openIndex + direction + visible.length) % visible.length;
    setOpenId(visible[nextIndex].id);
  }, [openIndex, visible]);
  const hostKindFor = (item: UpcomingItem): "IP" | "domain" => (/^(\d{1,3}\.){3}\d{1,3}/.test(item.host || "") ? "IP" : "domain");
  const openFromName = (event: MouseEvent, item: UpcomingItem) => {
    if ((event.target as HTMLElement).closest("button, a")) return;
    setOpenId(item.id);
  };
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
          <article key={item.id} data-entry-row className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-start gap-2 p-3">
              {disclosure(item)}
              <div className="min-w-0 flex-1 cursor-pointer" onClick={(event) => openFromName(event, item)}>
                <h3 className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
                  <span className="shrink-0" style={{ color: item.categoryColor || undefined }}><AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" /></span>
                  <span className="truncate">{item.name}</span>
                </h3>
                {hostLine(item) ? <div><CopyHost value={hostLine(item)} kind={hostKindFor(item)} locale={locale} /></div> : null}
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
            <col className="w-[8.75rem]" />
            <col className="w-[18%]" />
            <col className="w-[7.75rem]" />
            <col className="w-[7.5rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-0"><span className="sr-only">{tx(locale, "Details", "Детали")}</span></TableHead>
              <TableHead>{tx(locale, "Name", "Название")}</TableHead>
              <TableHead>{tx(locale, "Due", "Срок")}</TableHead>
              <TableHead title={tx(locale, "Vendor, with the account under it", "Поставщик, под ним аккаунт")}>{tx(locale, "Vendor", "Поставщик")}</TableHead>
              <TableHead className="text-right">{t(locale, "amount")}</TableHead>
              <TableHead className="pl-3 text-right">{t(locale, "actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <Fragment key={item.id}>
                <TableRow className={cn("group", openId === item.id && "bg-white/[0.03]")} data-entry-row>
                  <TableCell className="px-0 py-2 text-center">{disclosure(item)}</TableCell>
                  <TableCell className="cursor-pointer py-2.5 transition hover:bg-white/[0.03]" title={item.categoryName || undefined} onClick={(event) => openFromName(event, item)}>
                    <span className="flex min-w-0 items-center gap-2 font-medium text-white">
                      <span className="shrink-0" style={{ color: item.categoryColor || undefined }}><AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" /></span>
                      <span className="truncate group-hover:underline group-hover:decoration-zinc-600 group-hover:underline-offset-4">{item.name}</span>
                    </span>
                    {hostLine(item) ? <span className="block pl-[22px]"><CopyHost value={hostLine(item)} kind={hostKindFor(item)} locale={locale} /></span> : null}
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
                  <TableCell className="py-2 pl-3">
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
