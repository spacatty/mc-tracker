"use client";

import Link from "next/link";
import { Columns3, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";
import { saveItemAction } from "@/app/actions";
import { getCurrencySymbol } from "@/lib/currencies";
import type { BillingPeriod, Category, PaymentItem, VendorSuggestion } from "@/lib/types";
import { toDateInputValue } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";
import { CheckboxInput, SelectInput } from "./ui/hidden-input";
import { Input, Textarea } from "./ui/input";
import { RichNotesEditor } from "./rich-notes-editor";
import { VendorSuggestInputs } from "./vendor-suggest-input";
import { CurrencySearchSelect } from "./currency-search-select";

function addPeriod(start: string, period: string, customDays: number) {
  if (!start) return "";
  const date = new Date(`${start}T00:00:00`);
  if (period === "7d") date.setDate(date.getDate() + 7);
  else if (period === "3m") date.setMonth(date.getMonth() + 3);
  else if (period === "1y") date.setFullYear(date.getFullYear() + 1);
  else if (period === "custom") date.setDate(date.getDate() + (customDays || 30));
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function ItemForm({
  item,
  categories,
  vendorSuggestions,
  workspaceId,
}: {
  item?: PaymentItem | null;
  categories: Category[];
  vendorSuggestions: VendorSuggestion[];
  workspaceId: number;
}) {
  const [categoryId, setCategoryId] = useState(String(item?.categoryId || categories[0]?.id || ""));
  const [paymentType, setPaymentType] = useState(item?.paymentType || "recurring");
  const [period, setPeriod] = useState(item?.period || "1m");
  const [customDays, setCustomDays] = useState(item?.customPeriodDays || 30);
  const [startDate, setStartDate] = useState(toDateInputValue(item?.billingStartAt) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(toDateInputValue(item?.billingEndAt) || addPeriod(startDate, period, customDays));
  const [displayMode, setDisplayMode] = useState<"comfortable" | "linear">("comfortable");
  const [currency, setCurrency] = useState(item?.currency || "USD");

  const selectedCategory = useMemo(
    () => categories.find((category) => String(category.id) === categoryId) || categories[0],
    [categories, categoryId],
  );
  const selectedCategoryFields = selectedCategory?.fields || [];

  function syncEnd(nextStart = startDate, nextPeriod = period, nextDays = customDays) {
    if (paymentType === "recurring") {
      setEndDate(addPeriod(nextStart, nextPeriod, nextDays));
    }
  }

  return (
    <form action={saveItemAction} className="space-y-5">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Fast entry table</h2>
            <p className="text-sm text-zinc-500">Tab through the fields. Recurring dates auto-calculate from start date and period.</p>
          </div>
          <div className="flex rounded-2xl border border-white/10 bg-black/25 p-1">
            <Button
              type="button"
              variant={displayMode === "comfortable" ? "secondary" : "ghost"}
              size="icon"
              title="Two-column form layout"
              onClick={() => setDisplayMode("comfortable")}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={displayMode === "linear" ? "secondary" : "ghost"}
              size="icon"
              title="Column table layout"
              onClick={() => setDisplayMode("linear")}
            >
              <Columns3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {displayMode === "comfortable" ? (
        <div className="divide-y divide-white/10">
          <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
            <span className="text-sm font-medium text-zinc-400">Name</span>
            <Input name="name" defaultValue={item?.name} required placeholder="example.com, VPS-1, Cloudflare..." />
            <span className="text-sm font-medium text-zinc-400">Category</span>
            <SelectInput
              name="categoryId"
              defaultValue={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((category) => ({
                value: String(category.id),
                label: (
                  <span className="flex items-center gap-2">
                    <AppIcon name={category.icon} className="h-4 w-4" />
                    {category.name}
                  </span>
                ),
              }))}
            />
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
            <span className="text-sm font-medium text-zinc-400">Entry type</span>
            <SelectInput
              name="paymentType"
              defaultValue={paymentType}
              onValueChange={(value) => {
                setPaymentType(value as "single" | "recurring");
                if (value === "recurring") setEndDate(addPeriod(startDate, period, customDays));
                else if (!endDate) setEndDate(startDate);
              }}
              options={[
                { value: "single", label: "Single payment" },
                { value: "recurring", label: "Recurring" },
              ]}
            />
            <span className="text-sm font-medium text-zinc-400">Amount</span>
            <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-2">
              <Input name="amount" type="number" step="0.01" defaultValue={item?.amount ?? 0} />
              <CurrencySearchSelect name="currency" defaultValue={currency} onValueChange={setCurrency} />
              <p className="col-span-2 text-xs text-zinc-500">Currency symbol preview: {getCurrencySymbol(currency)}</p>
            </div>
          </div>
          {paymentType === "recurring" ? (
            <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
              <span className="text-sm font-medium text-zinc-400">Period</span>
              <SelectInput
                name="period"
                defaultValue={period}
                onValueChange={(value) => {
                  const nextPeriod = value as BillingPeriod;
                  setPeriod(nextPeriod);
                  syncEnd(startDate, nextPeriod, customDays);
                }}
                options={[
                  { value: "7d", label: "7 days" },
                  { value: "1m", label: "1 month" },
                  { value: "3m", label: "3 months" },
                  { value: "1y", label: "1 year" },
                  { value: "custom", label: "Custom days" },
                ]}
              />
              <span className="text-sm font-medium text-zinc-400">Custom days</span>
              {period === "custom" ? (
                <Input
                  name="customPeriodDays"
                  type="number"
                  min="1"
                  value={customDays}
                  onChange={(event) => {
                    const next = Number(event.target.value || 30);
                    setCustomDays(next);
                    syncEnd(startDate, period, next);
                  }}
                />
              ) : (
                <input type="hidden" name="customPeriodDays" value={customDays} />
              )}
            </div>
          ) : null}
          <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
            <span className="text-sm font-medium text-zinc-400">Start date</span>
            <DatePickerInput
              name="billingStartAt"
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
                syncEnd(value, period, customDays);
              }}
            />
            <span className="text-sm font-medium text-zinc-400">Expiry date</span>
            <DatePickerInput key={endDate} name="billingEndAt" value={endDate} onChange={setEndDate} />
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[180px_minmax(220px,1fr)_180px_minmax(220px,1fr)] lg:items-center">
            <span className="text-sm font-medium text-zinc-400">Vendor / URL / Account</span>
            <div className="lg:col-span-3">
              <VendorSuggestInputs suggestions={vendorSuggestions} defaultVendor={item?.vendorName} defaultUrl={item?.vendorUrl} defaultAccount={item?.accountName} />
            </div>
          </div>
        </div>
        ) : (
        <div className="divide-y divide-white/10 p-3">
          <div className="space-y-1.5 pb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</span>
            <Input name="name" defaultValue={item?.name} required placeholder="example.com" />
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Category</span>
            <SelectInput
              name="categoryId"
              defaultValue={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((category) => ({
                value: String(category.id),
                label: (
                  <span className="flex items-center gap-2">
                    <AppIcon name={category.icon} className="h-4 w-4" />
                    {category.name}
                  </span>
                ),
              }))}
            />
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Amount</span>
            <div className="grid grid-cols-[minmax(0,1fr)_180px] gap-1.5">
              <Input name="amount" type="number" step="0.01" defaultValue={item?.amount ?? 0} />
              <CurrencySearchSelect name="currency" defaultValue={currency} onValueChange={setCurrency} />
              <p className="col-span-2 text-xs text-zinc-500">Currency symbol preview: {getCurrencySymbol(currency)}</p>
            </div>
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Type</span>
            <SelectInput
              name="paymentType"
              defaultValue={paymentType}
              onValueChange={(value) => {
                setPaymentType(value as "single" | "recurring");
                if (value === "recurring") setEndDate(addPeriod(startDate, period, customDays));
                else if (!endDate) setEndDate(startDate);
              }}
              options={[
                { value: "single", label: "Single" },
                { value: "recurring", label: "Recurring" },
              ]}
            />
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Period</span>
            {paymentType === "recurring" ? (
              <SelectInput
                name="period"
                defaultValue={period}
                onValueChange={(value) => {
                  const nextPeriod = value as BillingPeriod;
                  setPeriod(nextPeriod);
                  syncEnd(startDate, nextPeriod, customDays);
                }}
                options={[
                  { value: "7d", label: "7 days" },
                  { value: "1m", label: "1 month" },
                  { value: "3m", label: "3 months" },
                  { value: "1y", label: "1 year" },
                  { value: "custom", label: "Custom days" },
                ]}
              />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-500">
                No period
                <input type="hidden" name="period" value={period} />
              </div>
            )}
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Start</span>
            <DatePickerInput
              name="billingStartAt"
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
                syncEnd(value, period, customDays);
              }}
            />
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Expiry</span>
            <DatePickerInput key={endDate} name="billingEndAt" value={endDate} onChange={setEndDate} />
          </div>
          <div className="space-y-1.5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Vendor / URL / Account</span>
            <VendorSuggestInputs suggestions={vendorSuggestions} defaultVendor={item?.vendorName} defaultUrl={item?.vendorUrl} defaultAccount={item?.accountName} className="grid gap-2" />
          </div>
          {paymentType === "recurring" && period === "custom" ? (
            <div className="space-y-1.5 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Custom days</span>
              <Input
                name="customPeriodDays"
                type="number"
                min="1"
                value={customDays}
                onChange={(event) => {
                  const next = Number(event.target.value || 30);
                  setCustomDays(next);
                  syncEnd(startDate, period, next);
                }}
              />
            </div>
          ) : (
            <input type="hidden" name="customPeriodDays" value={customDays} />
          )}
        </div>
        )}
      </section>

      {selectedCategoryFields.length ? (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">{selectedCategory.name} fields</h2>
          </div>
          <div className="divide-y divide-white/10">
            {selectedCategoryFields.map((field) => (
              <div key={field.id} className="grid gap-4 p-4 lg:grid-cols-[220px_1fr] lg:items-center">
                <span className="text-sm" style={{ color: field.color, fontWeight: field.bold ? 700 : 400 }}>
                  {field.label}{field.required ? " *" : ""}
                </span>
                {field.type === "textarea" ? (
                  <Textarea name={`custom_${field.id}`} defaultValue={String(item?.customFields[field.id] || "")} />
                ) : field.type === "checkbox" ? (
                  <CheckboxInput name={`custom_${field.id}`} defaultChecked={Boolean(item?.customFields[field.id])}>Enabled</CheckboxInput>
                ) : field.type === "select" && field.options?.length ? (
                  <SelectInput
                    name={`custom_${field.id}`}
                    defaultValue={String(item?.customFields[field.id] || field.options?.[0] || "")}
                    options={(field.options || []).map((option) => ({ value: option, label: option }))}
                  />
                ) : field.type === "select" ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-sm text-zinc-500">No select options configured for this field.</p>
                ) : field.type === "date" ? (
                  <DatePickerInput name={`custom_${field.id}`} value={String(item?.customFields[field.id] || "")} />
                ) : (
                  <Input name={`custom_${field.id}`} type={field.type === "number" ? "number" : "text"} defaultValue={String(item?.customFields[field.id] || "")} />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-4 text-lg font-semibold text-white">Markdown notes / credentials</h2>
        <RichNotesEditor defaultValue={item?.notes || ""} />
      </section>

      <div className="flex gap-3">
        <Button>Save entry</Button>
        <Button asChild variant="outline">
          <Link href={`/app/items?workspace=${workspaceId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
