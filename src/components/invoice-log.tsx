"use client";

import { CalendarClock, ReceiptText, Repeat } from "lucide-react";
import { useMemo, useState } from "react";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { BillingPeriod, Category, Invoice } from "@/lib/types";
import { displayDate, formatMoney } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { SearchInput } from "./ui/input";
import { SectionCard } from "./ui/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableToolbar,
} from "./ui/table";

const PAGE_SIZE = 20;

function periodText(locale: Locale, period: BillingPeriod | null, customDays?: number | null) {
  if (period === "7d") return tx(locale, "7 days", "7 дней");
  if (period === "3m") return tx(locale, "3 months", "3 месяца");
  if (period === "1y") return tx(locale, "1 year", "1 год");
  if (period === "custom") return tx(locale, `${customDays || 30} days`, `${customDays || 30} дн.`);
  return tx(locale, "1 month", "1 месяц");
}

function dateText(value: string | null) {
  return value ? displayDate(value) : "—";
}

function hostOf(url: string) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function matches(invoice: Invoice, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [invoice.itemName, invoice.categoryName, invoice.vendorName, invoice.accountName, invoice.vendorUrl, invoice.currency]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function InvoiceLog({ invoices, categories, locale = "en", actions }: { invoices: Invoice[]; categories: Category[]; locale?: Locale; actions?: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const filtered = useMemo(() => invoices.filter((invoice) => matches(invoice, query)), [invoices, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const countLabel = query
    ? tx(locale, `${filtered.length} of ${invoices.length}`, `${filtered.length} из ${invoices.length}`)
    : tx(locale, `${invoices.length} total`, `Всего: ${invoices.length}`);

  function categoryBadge(invoice: Invoice) {
    const category = invoice.categoryId ? categoryById.get(invoice.categoryId) : undefined;
    return (
      <Badge color={category?.color} icon={<AppIcon name={category?.icon} />} className="text-[11.5px]">
        {invoice.categoryName || t(locale, "uncategorized")}
      </Badge>
    );
  }

  function effects(invoice: Invoice) {
    if (!invoice.shiftDates && !invoice.shiftPaymentPeriod) return <span className="text-zinc-600">—</span>;
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {invoice.shiftDates ? (
          <Badge tone="success" icon={<CalendarClock />}>
            {tx(locale, "Dates shifted", "Даты сдвинуты")}
          </Badge>
        ) : null}
        {invoice.shiftPaymentPeriod ? (
          <Badge tone="accent" icon={<Repeat />}>
            {tx(locale, "Period changed", "Период изменён")}
          </Badge>
        ) : null}
      </div>
    );
  }

  const noneYet = !invoices.length;
  const emptyTitle = noneYet ? t(locale, "noInvoicesYet") : tx(locale, "Nothing matches", "Ничего не найдено");
  const emptyDescription = noneYet
    ? tx(locale, "Record a payment to start the log.", "Запишите первую оплату — здесь появится журнал.")
    : tx(locale, "Try a different search.", "Попробуйте другой запрос.");

  return (
    <SectionCard title={t(locale, "invoiceLog")} description={t(locale, "invoiceHistoryDescription")} actions={actions} flush className="flex min-h-[24rem] flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
      <TableToolbar end={<span className="text-xs tabular-nums text-zinc-500">{countLabel}</span>}>
        <SearchInput
          size="sm"
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPage(1);
          }}
          placeholder={tx(locale, "Search invoices", "Поиск по счетам")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="max-w-sm flex-1"
        />
      </TableToolbar>

      {/* Mobile: card list */}
      <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
        {rows.length ? (
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((invoice) => (
              <li key={invoice.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-zinc-100">{invoice.itemName || t(locale, "manualInvoice")}</p>
                    <div className="mt-0.5">{categoryBadge(invoice)}</div>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-zinc-100">{formatMoney(invoice.amount, invoice.currency)}</p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                  <div className="min-w-0">
                    <dt className="text-zinc-500">{t(locale, "vendor")}</dt>
                    <dd className="truncate text-zinc-300">{invoice.vendorName || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{t(locale, "period")}</dt>
                    <dd className="text-zinc-300">{periodText(locale, invoice.period, invoice.customPeriodDays)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-zinc-500">{tx(locale, "Paid on → due", "Оплата → срок")}</dt>
                    <dd className="tabular-nums text-zinc-300">
                      {dateText(invoice.paymentDate)} <span className="text-zinc-600">→</span> {dateText(invoice.dueDate)}
                    </dd>
                  </div>
                </dl>
                {invoice.shiftDates || invoice.shiftPaymentPeriod ? <div className="mt-2">{effects(invoice)}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<ReceiptText />} title={emptyTitle} description={emptyDescription} />
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <Table bare fill minWidth={860}>
          <TableHeader>
            <TableRow>
              <TableHead>{t(locale, "entry")}</TableHead>
              <TableHead>{t(locale, "vendor")}</TableHead>
              <TableHead>{tx(locale, "Paid on → due", "Оплата → срок")}</TableHead>
              <TableHead>{t(locale, "period")}</TableHead>
              <TableHead align="right">{t(locale, "amount")}</TableHead>
              <TableHead>{tx(locale, "Effect", "Изменения")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((invoice) => {
              const secondary = invoice.accountName || (invoice.vendorUrl ? hostOf(invoice.vendorUrl) : "");
              return (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <p className="max-w-64 truncate font-medium text-zinc-100">{invoice.itemName || t(locale, "manualInvoice")}</p>
                    <div className="mt-0.5">{categoryBadge(invoice)}</div>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-48 truncate text-zinc-300">{invoice.vendorName || "—"}</p>
                    {secondary ? <p className="max-w-48 truncate text-[11.5px] text-zinc-500">{secondary}</p> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <span className="text-zinc-300">{dateText(invoice.paymentDate)}</span>
                    <span className="mx-1.5 text-zinc-600">→</span>
                    <span>{dateText(invoice.dueDate)}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{periodText(locale, invoice.period, invoice.customPeriodDays)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums text-zinc-100">
                    {formatMoney(invoice.amount, invoice.currency)}
                  </TableCell>
                  <TableCell>{effects(invoice)}</TableCell>
                </TableRow>
              );
            })}
            {!rows.length ? <TableEmpty colSpan={6} icon={<ReceiptText />} title={emptyTitle} description={emptyDescription} /> : null}
          </TableBody>
        </Table>
      </div>

      {filtered.length > PAGE_SIZE || pageSize !== PAGE_SIZE ? (
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          total={filtered.length}
          locale={locale}
        />
      ) : null}
    </SectionCard>
  );
}
