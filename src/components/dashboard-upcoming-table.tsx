"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PaymentItem } from "@/lib/types";
import { displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { AppIcon } from "./icons";
import { DashboardUpcomingActions } from "./dashboard-upcoming-actions";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

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
      <div className="space-y-3 p-3 md:hidden">
        {items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-lg border border-border bg-surface-muted">
            <div className="p-3">
              <div className="flex items-start gap-2">
                {disclosure(item)}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">{item.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.vendorName || "—"} · {item.accountName || "—"}</p>
                </div>
                <DashboardUpcomingActions workspaceId={item.workspaceId || workspaceId} itemId={item.id} itemName={item.name} amountLabel={formatMoney(item.amount, item.currency)} locale={locale} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 pl-8">
                <div>
                  <Badge className="gap-2" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}20`, color: item.categoryColor || "#c4b5fd" }}>
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
        {!items.length ? <p className="py-8 text-center text-sm text-muted-foreground">{tx(locale, "No payments due in the next 2 weeks.", "Платежей в ближайшие 2 недели нет.")}</p> : null}
      </div>

      <div className="hidden md:block">
        <Table className="border-0">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-2"><span className="sr-only">{tx(locale, "Details", "Детали")}</span></TableHead>
              <TableHead>{tx(locale, "Name", "Название")}</TableHead>
              <TableHead>{tx(locale, "Payment date", "Дата оплаты")}</TableHead>
              <TableHead>{t(locale, "category")}</TableHead>
              <TableHead>{tx(locale, "Vendor", "Вендор")}</TableHead>
              <TableHead>{tx(locale, "Account", "Аккаунт")}</TableHead>
              <TableHead className="text-right">{t(locale, "amount")}</TableHead>
              <TableHead className="text-right">{t(locale, "actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <Fragment key={item.id}>
                <TableRow className="group">
                  <TableCell className="w-10 px-2">{disclosure(item)}</TableCell>
                  <TableCell className="font-medium text-white">{item.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-zinc-300">
                    {relativeDays(item.daysUntilPayment, locale)} <span className="text-zinc-500">({displayDate(item.nextPaymentAt)})</span>
                  </TableCell>
                  <TableCell>
                    <Badge className="gap-2" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}25`, color: item.categoryColor || "#c4b5fd" }}>
                      <AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" />
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
                  <TableCell className="text-zinc-300">{item.accountName || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-white">{formatMoney(item.amount, item.currency)}</TableCell>
                  <TableCell>
                    <DashboardUpcomingActions
                      workspaceId={item.workspaceId || workspaceId}
                      itemId={item.id}
                      itemName={item.name}
                      amountLabel={formatMoney(item.amount, item.currency)}
                      locale={locale}
                    />
                  </TableCell>
                </TableRow>
                {expanded.has(item.id) ? (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-surface-muted px-4 py-3">{details(item)}</TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
            {!items.length ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-zinc-500">{tx(locale, "No payments due in the next 2 weeks.", "Платежей в ближайшие 2 недели нет.")}</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
