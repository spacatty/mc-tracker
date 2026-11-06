"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, ReceiptText } from "lucide-react";
import { createInvoiceAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { BillingPeriod, Category, PaymentItem } from "@/lib/types";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DatePickerInput } from "./ui/date-picker";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, Fieldset } from "./ui/field";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { EntrySearchSelect } from "./entry-search-select";
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

/** A Checkbox with a label and a one-line description. Submits `name=on` while checked, like a native checkbox. */
function CheckboxRow({
  id,
  name,
  defaultChecked = false,
  label,
  description,
}: {
  id: string;
  name: string;
  defaultChecked?: boolean;
  label: string;
  description: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => setChecked(next === true)}
        aria-describedby={`${id}-description`}
        className="mt-0.5"
      />
      {checked ? <input type="hidden" name={name} value="on" /> : null}
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[13px] font-medium text-zinc-200">
          {label}
        </label>
        <p id={`${id}-description`} className="mt-0.5 text-[11.5px] leading-[1.125rem] text-zinc-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function SubmitButton({ locale }: { locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
      {t(locale, "recordPayment")}
    </Button>
  );
}

export function InvoiceForm({
  entries,
  categories,
  workspaceId,
  locale = "en",
  onCancel,
}: {
  entries: PaymentItem[];
  categories: Category[];
  workspaceId: number;
  locale?: Locale;
  /** When set, the form renders as dialog parts (body + footer with Cancel). */
  onCancel?: () => void;
}) {
  const [itemId, setItemId] = useState(entries[0] ? String(entries[0].id) : "");
  const selectedEntry = useMemo(() => entries.find((entry) => String(entry.id) === itemId), [entries, itemId]);
  const [period, setPeriod] = useState<BillingPeriod>(selectedEntry?.period || "1m");
  const [customDays, setCustomDays] = useState(selectedEntry?.customPeriodDays || 30);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(addPeriod(paymentDate, period, customDays));

  const periodOptions: Array<{ value: BillingPeriod; label: string }> = [
    { value: "7d", label: tx(locale, "7 days", "7 дней") },
    { value: "1m", label: tx(locale, "1 month", "1 месяц") },
    { value: "3m", label: tx(locale, "3 months", "3 месяца") },
    { value: "1y", label: tx(locale, "1 year", "1 год") },
    { value: "custom", label: tx(locale, "Custom days", "Своё число дней") },
  ];

  return (
    <form action={createInvoiceAction} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="vendorName" value={selectedEntry?.vendorName || ""} />
      <input type="hidden" name="vendorUrl" value={selectedEntry?.vendorUrl || ""} />
      <input type="hidden" name="accountName" value={selectedEntry?.accountName || ""} />
      <input type="hidden" name="period" value={period} />
      {period !== "custom" ? <input type="hidden" name="customPeriodDays" value={customDays} /> : null}

      <DialogBody className="space-y-6">
        <Field label={t(locale, "entry")}>
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
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(locale, "paymentDate")} htmlFor="invoice-payment-date">
            <DatePickerInput
              name="paymentDate"
              triggerId="invoice-payment-date"
              value={paymentDate}
              locale={locale}
              onChange={(value) => {
                setPaymentDate(value);
                setDueDate(addPeriod(value, period, customDays));
              }}
            />
          </Field>
          <Field
            label={tx(locale, "Due date", "Срок оплаты")}
            hint={tx(locale, "Calculated from the payment date and period.", "Рассчитывается по дате оплаты и периоду.")}
          >
            <div
              className="flex h-9 items-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-sm tabular-nums text-zinc-300"
              aria-live="polite"
            >
              {dueDate
                ? new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-GB")
                : <span className="text-zinc-500">{tx(locale, "Calculated from period", "Рассчитывается по периоду")}</span>}
            </div>
          </Field>

          <Field label={t(locale, "amount")} htmlFor="invoice-amount">
            <Input
              key={`${itemId}-amount`}
              id="invoice-amount"
              name="amount"
              type="number"
              step="0.01"
              defaultValue={selectedEntry?.amount || 0}
              className="tabular-nums"
            />
          </Field>
          <Field label={tx(locale, "Currency", "Валюта")} htmlFor="invoice-currency">
            <CurrencySearchSelect
              key={`${itemId}-currency`}
              name="currency"
              triggerId="invoice-currency"
              defaultValue={selectedEntry?.currency || "USD"}
              locale={locale}
            />
          </Field>

          <Field label={tx(locale, "Invoice period", "Период счёта")} htmlFor="invoice-period">
            <Select
              value={period}
              onValueChange={(value) => {
                const next = value as BillingPeriod;
                setPeriod(next);
                setDueDate(addPeriod(paymentDate, next, customDays));
              }}
            >
              <SelectTrigger id="invoice-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {period === "custom" ? (
            <Field label={tx(locale, "Custom days", "Число дней")} htmlFor="invoice-custom-days">
              <Input
                id="invoice-custom-days"
                name="customPeriodDays"
                type="number"
                min={1}
                value={customDays}
                className="tabular-nums"
                onChange={(event) => {
                  const next = Number(event.target.value || 30);
                  setCustomDays(next);
                  setDueDate(addPeriod(paymentDate, period, next));
                }}
              />
            </Field>
          ) : null}
        </div>

        <Fieldset legend={t(locale, "scheduleUpdates")}>
          <CheckboxRow
            id={`invoice-shift-dates-${workspaceId}`}
            name="shiftDates"
            defaultChecked
            label={tx(locale, "Shift the entry's payment dates", "Сдвинуть даты оплаты записи")}
            description={tx(
              locale,
              "The entry's paid period becomes the payment date through the due date above; the dashboard and reminders use the new due date.",
              "Оплаченным периодом записи станет промежуток от даты оплаты до срока, указанного выше; обзор и напоминания будут отсчитываться от нового срока.",
            )}
          />
          <CheckboxRow
            id={`invoice-shift-period-${workspaceId}`}
            name="shiftPaymentPeriod"
            label={tx(locale, "Also change the entry's billing period", "Также изменить период оплаты записи")}
            description={tx(
              locale,
              "The entry switches to this invoice period and amount, e.g. a 3-month invoice makes it a 3-month entry.",
              "Запись перейдёт на период и сумму этого счёта: например, после счёта за 3 месяца она станет трёхмесячной.",
            )}
          />
        </Fieldset>
      </DialogBody>

      <DialogFooter
        hint={
          <>
            <Kbd>Esc</Kbd> {tx(locale, "to close", "закрыть")}
          </>
        }
      >
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t(locale, "cancel")}
          </Button>
        ) : null}
        <SubmitButton locale={locale} />
      </DialogFooter>
    </form>
  );
}

/**
 * The page-header primary action on /app/invoices: an Aurora "Record payment" button that opens the invoice form
 * in a dialog. The trigger is built here (not passed from the server page) to avoid a hydration mismatch.
 * The page remounts this component (via `key`) after a successful submit, which closes the dialog.
 */
export function RecordPaymentDialog({
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t(locale, "recordPayment")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" closeLabel={tx(locale, "Close", "Закрыть")}>
          <DialogHeader icon={<ReceiptText />} tone="success">
            <DialogTitle>{t(locale, "recordPayment")}</DialogTitle>
            <DialogDescription>{t(locale, "recordPaymentDescription")}</DialogDescription>
          </DialogHeader>
          <InvoiceForm
            entries={entries}
            categories={categories}
            workspaceId={workspaceId}
            locale={locale}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
