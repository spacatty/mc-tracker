"use client";

import { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { createInvoiceAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { BillingPeriod, Category, PaymentItem } from "@/lib/types";
import { Button } from "./ui/button";
import { CheckboxInput, SelectInput } from "./ui/hidden-input";
import { Input } from "./ui/input";
import { DatePickerInput } from "./ui/date-picker";
import { EntrySearchSelect } from "./entry-search-select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CurrencySearchSelect } from "./currency-search-select";

function addPeriod(start: string, period: BillingPeriod, customDays: number) {
  if (!start) return "";
  const date = new Date(`${start}T00:00:00`);
  if (period === "7d") date.setDate(date.getDate() + 7);
  else if (period === "3m") date.setMonth(date.getMonth() + 3);
  else if (period === "1y") date.setFullYear(date.getFullYear() + 1);
  else if (period === "custom") date.setDate(date.getDate() + customDays);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function HelpTooltip({ children, locale = "en" }: { children: React.ReactNode; locale?: Locale }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-zinc-500 transition hover:text-violet-200" aria-label={locale === "ru" ? "Подробнее" : "More info"}>
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-xs text-sm text-zinc-300">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function InvoiceForm({
  entries,
  categories,
  workspaceId,
  locale = "en",
}: {
  entries: PaymentItem[];
  categories: Category[];
  workspaceId: number;
  locale?: Locale;
}) {
  const [itemId, setItemId] = useState(entries[0] ? String(entries[0].id) : "");
  const selectedEntry = useMemo(() => entries.find((entry) => String(entry.id) === itemId), [entries, itemId]);
  const [period, setPeriod] = useState<BillingPeriod>(selectedEntry?.period || "1m");
  const [customDays, setCustomDays] = useState(selectedEntry?.customPeriodDays || 30);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(addPeriod(paymentDate, period, customDays));

  return (
    <form action={createInvoiceAction} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="border-b border-white/10 bg-black/20 p-5">
        <h2 className="text-lg font-semibold text-white">{t(locale, "addInvoice")}</h2>
        <p className="text-sm text-zinc-500">{locale === "ru" ? "Выберите запись, укажите даты счета и при необходимости сдвиньте исходный график." : "Select an entry, record invoice dates, and optionally shift the original entry schedule."}</p>
      </div>
      <div className="divide-y divide-white/10">
        <div className="grid gap-4 p-4 lg:grid-cols-[180px_1fr] lg:items-start">
          <span className="pt-2 text-sm font-medium text-zinc-400">{t(locale, "entry")}</span>
          <EntrySearchSelect
            entries={entries}
            categories={categories}
            value={itemId}
            locale={locale}
            onChange={(value) => {
              setItemId(value);
              const next = entries.find((entry) => String(entry.id) === value);
              if (next?.period) {
                setPeriod(next.period);
                setDueDate(addPeriod(paymentDate, next.period, next.customPeriodDays || customDays));
              }
            }}
          />
        </div>
        <input type="hidden" name="dueDate" value={dueDate} />
        <input type="hidden" name="vendorName" value={selectedEntry?.vendorName || ""} />
        <input type="hidden" name="vendorUrl" value={selectedEntry?.vendorUrl || ""} />
        <input type="hidden" name="accountName" value={selectedEntry?.accountName || ""} />
        <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
          <span className="text-sm font-medium text-zinc-400">{t(locale, "paymentDate")}</span>
          <DatePickerInput
            name="paymentDate"
            value={paymentDate}
            onChange={(value) => {
              setPaymentDate(value);
              setDueDate(addPeriod(value, period, customDays));
            }}
          />
          <span className="text-sm font-medium text-zinc-400">{locale === "ru" ? "Авто дата оплаты" : "Auto due date"}</span>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-300">
            {dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-GB") : (locale === "ru" ? "Вычисляется из периода" : "Calculated from period")}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
          <span className="text-sm font-medium text-zinc-400">{t(locale, "amount")}</span>
          <Input key={`${itemId}-amount`} name="amount" type="number" step="0.01" defaultValue={selectedEntry?.amount || 0} />
          <span className="text-sm font-medium text-zinc-400">{locale === "ru" ? "Валюта" : "Currency"}</span>
          <CurrencySearchSelect key={`${itemId}-currency`} name="currency" defaultValue={selectedEntry?.currency || "USD"} />
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
          <span className="text-sm font-medium text-zinc-400">{locale === "ru" ? "Период счета" : "Invoice period"}</span>
          <SelectInput
            name="period"
            defaultValue={period}
            onValueChange={(value) => {
              const next = value as BillingPeriod;
              setPeriod(next);
              setDueDate(addPeriod(paymentDate, next, customDays));
            }}
            options={[
              { value: "7d", label: locale === "ru" ? "7 дней" : "7 days" },
              { value: "1m", label: locale === "ru" ? "1 месяц" : "1 month" },
              { value: "3m", label: locale === "ru" ? "3 месяца" : "3 months" },
              { value: "1y", label: locale === "ru" ? "1 год" : "1 year" },
              { value: "custom", label: locale === "ru" ? "Свои дни" : "Custom days" },
            ]}
          />
          <span className="text-sm font-medium text-zinc-400">{locale === "ru" ? "Свои дни" : "Custom days"}</span>
          {period === "custom" ? (
            <Input
              name="customPeriodDays"
              type="number"
              value={customDays}
              onChange={(event) => {
                const next = Number(event.target.value || 30);
                setCustomDays(next);
                setDueDate(addPeriod(paymentDate, period, next));
              }}
            />
          ) : (
            <input type="hidden" name="customPeriodDays" value={customDays} />
          )}
        </div>
        <div className="flex flex-wrap gap-5 p-4">
          <span className="inline-flex items-center gap-2">
            <CheckboxInput name="shiftDates" defaultChecked>{locale === "ru" ? "Сдвигать даты оплаты записи по счету" : "Shift entry payment dates according to invoice"}</CheckboxInput>
            <HelpTooltip locale={locale}>
              {locale === "ru"
                ? "Если включено, текущий оплаченный период выбранной записи сдвигается на даты счета до вычисленной даты оплаты."
                : "When enabled, the selected entry's current paid period becomes the invoice payment date through the calculated invoice due date. Dashboard upcoming totals and notifications will use that new due date."}
            </HelpTooltip>
          </span>
          <span className="inline-flex items-center gap-2">
            <CheckboxInput name="shiftPaymentPeriod">{locale === "ru" ? "Также изменить период записи на период счета" : "Also change entry billing period to invoice period"}</CheckboxInput>
            <HelpTooltip locale={locale}>
              {locale === "ru"
                ? "Если включено, период записи станет равен периоду счета. Например, счет на 3 месяца обновит период записи до 3 месяцев."
                : "When enabled, the entry's recurring period is changed to this invoice period. Example: paying a 3-month invoice for 150 changes the entry to a 3-month period and updates its price to 150."}
            </HelpTooltip>
          </span>
        </div>
        <div className="p-4">
          <Button>{locale === "ru" ? "Создать счет" : "Create invoice"}</Button>
        </div>
      </div>
    </form>
  );
}
