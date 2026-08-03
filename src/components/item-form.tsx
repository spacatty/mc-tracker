"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveItemAction } from "@/app/actions";
import { getCurrencySymbol } from "@/lib/currencies";
import { t, type Locale } from "@/lib/i18n";
import type { BillingPeriod, Category, PaymentItem, VendorSuggestion } from "@/lib/types";
import { toDateInputValue } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Button } from "./ui/button";
import { DatePickerInput } from "./ui/date-picker";
import { CheckboxInput, SelectInput } from "./ui/hidden-input";
import { Input, Textarea } from "./ui/input";
import { Field, FieldDescription, FieldLabel } from "./ui/field";
import { PageHeader } from "./ui/page-header";
import { Surface } from "./ui/surface";
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
  locale,
}: {
  item?: PaymentItem | null;
  categories: Category[];
  vendorSuggestions: VendorSuggestion[];
  workspaceId: number;
  locale: Locale;
}) {
  const [categoryId, setCategoryId] = useState(String(item?.categoryId || categories[0]?.id || ""));
  const [paymentType, setPaymentType] = useState(item?.paymentType || "recurring");
  const [period, setPeriod] = useState(item?.period || "1m");
  const [customDays, setCustomDays] = useState(item?.customPeriodDays || 30);
  const [startDate, setStartDate] = useState(toDateInputValue(item?.billingStartAt) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(toDateInputValue(item?.billingEndAt) || addPeriod(startDate, period, customDays));
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
      <PageHeader
        eyebrow={t(locale, "editEntry")}
        title={item?.name || t(locale, "createEntry")}
        description={t(locale, "editEntryDescription")}
      />

      <Surface className="p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{t(locale, "entryDetails")}</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="item-name">{t(locale, "name")}</FieldLabel>
            <Input id="item-name" name="name" defaultValue={item?.name} required placeholder={t(locale, "namePlaceholder")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-category">{t(locale, "category")}</FieldLabel>
            <SelectInput
              name="categoryId"
              triggerId="item-category"
              ariaLabel={t(locale, "category")}
              defaultValue={categoryId}
              onValueChange={setCategoryId}
              options={categories.map((category) => ({
                value: String(category.id),
                label: <span className="flex items-center gap-2"><AppIcon name={category.icon} className="h-4 w-4" />{category.name}</span>,
              }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-type">{t(locale, "entryType")}</FieldLabel>
            <SelectInput
              name="paymentType"
              triggerId="item-type"
              ariaLabel={t(locale, "entryType")}
              defaultValue={paymentType}
              onValueChange={(value) => {
                setPaymentType(value as "single" | "recurring");
                if (value === "recurring") setEndDate(addPeriod(startDate, period, customDays));
                else if (!endDate) setEndDate(startDate);
              }}
              options={[
                { value: "single", label: t(locale, "singlePayment") },
                { value: "recurring", label: t(locale, "recurring") },
              ]}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)]">
            <Field>
              <FieldLabel htmlFor="item-amount">{t(locale, "amount")}</FieldLabel>
              <Input id="item-amount" name="amount" type="number" step="0.01" defaultValue={item?.amount ?? 0} />
            </Field>
            <Field>
              <FieldLabel htmlFor="item-currency">{t(locale, "currency")}</FieldLabel>
              <CurrencySearchSelect
                name="currency"
                triggerId="item-currency"
                ariaLabel={t(locale, "currency")}
                defaultValue={currency}
                onValueChange={setCurrency}
                locale={locale}
              />
              <FieldDescription>{t(locale, "currencySymbolPreview")}: {getCurrencySymbol(currency)}</FieldDescription>
            </Field>
          </div>
          {paymentType === "recurring" ? (
            <>
              <Field>
                <FieldLabel htmlFor="item-period">{t(locale, "period")}</FieldLabel>
                <SelectInput
                  name="period"
                  triggerId="item-period"
                  ariaLabel={t(locale, "period")}
                  defaultValue={period}
                  onValueChange={(value) => {
                    const nextPeriod = value as BillingPeriod;
                    setPeriod(nextPeriod);
                    syncEnd(startDate, nextPeriod, customDays);
                  }}
                  options={[
                    { value: "7d", label: t(locale, "sevenDays") },
                    { value: "1m", label: t(locale, "oneMonth") },
                    { value: "3m", label: t(locale, "threeMonths") },
                    { value: "1y", label: t(locale, "oneYear") },
                    { value: "custom", label: t(locale, "customDays") },
                  ]}
                />
              </Field>
              {period === "custom" ? (
                <Field>
                  <FieldLabel htmlFor="item-custom-days">{t(locale, "customDays")}</FieldLabel>
                  <Input
                    id="item-custom-days"
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
                </Field>
              ) : <input type="hidden" name="customPeriodDays" value={customDays} />}
            </>
          ) : <input type="hidden" name="customPeriodDays" value={customDays} />}
          <Field>
            <FieldLabel htmlFor="item-start-date">{t(locale, "startDate")}</FieldLabel>
            <DatePickerInput
              name="billingStartAt"
              triggerId="item-start-date"
              ariaLabel={t(locale, "startDate")}
              placeholder={t(locale, "startDate")}
              locale={locale}
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
                syncEnd(value, period, customDays);
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-end-date">{t(locale, "expiryDate")}</FieldLabel>
            <DatePickerInput
              key={endDate}
              name="billingEndAt"
              triggerId="item-end-date"
              ariaLabel={t(locale, "expiryDate")}
              placeholder={t(locale, "expiryDate")}
              locale={locale}
              value={endDate}
              onChange={setEndDate}
            />
          </Field>
        </div>
      </Surface>

      <Surface className="p-5">
        <h2 className="mb-5 text-lg font-semibold text-foreground">{t(locale, "vendorDetails")}</h2>
        <VendorSuggestInputs
          suggestions={vendorSuggestions}
          defaultVendor={item?.vendorName}
          defaultUrl={item?.vendorUrl}
          defaultAccount={item?.accountName}
          locale={locale}
        />
      </Surface>

      {selectedCategoryFields.length ? (
        <Surface className="p-5">
          <h2 className="mb-5 text-lg font-semibold text-foreground">{selectedCategory.name} · {t(locale, "customFields")}</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {selectedCategoryFields.map((field) => (
              <Field key={field.id}>
                <FieldLabel htmlFor={`custom-${field.id}`} style={{ color: field.color, fontWeight: field.bold ? 700 : 400 }}>
                  {field.label}{field.required ? " *" : ""}
                </FieldLabel>
                {field.type === "textarea" ? (
                  <Textarea id={`custom-${field.id}`} name={`custom_${field.id}`} required={field.required} defaultValue={String(item?.customFields[field.id] || "")} />
                ) : field.type === "checkbox" ? (
                  <CheckboxInput id={`custom-${field.id}`} name={`custom_${field.id}`} defaultChecked={Boolean(item?.customFields[field.id])}>{t(locale, "enabled")}</CheckboxInput>
                ) : field.type === "select" && field.options?.length ? (
                  <SelectInput
                    name={`custom_${field.id}`}
                    triggerId={`custom-${field.id}`}
                    ariaLabel={field.label}
                    defaultValue={String(item?.customFields[field.id] || field.options?.[0] || "")}
                    options={(field.options || []).map((option) => ({ value: option, label: option }))}
                  />
                ) : field.type === "select" ? (
                  <FieldDescription>{t(locale, "noSelectOptions")}</FieldDescription>
                ) : field.type === "date" ? (
                  <DatePickerInput
                    name={`custom_${field.id}`}
                    triggerId={`custom-${field.id}`}
                    ariaLabel={field.label}
                    locale={locale}
                    value={String(item?.customFields[field.id] || "")}
                  />
                ) : (
                  <Input id={`custom-${field.id}`} name={`custom_${field.id}`} required={field.required} type={field.type === "number" ? "number" : "text"} defaultValue={String(item?.customFields[field.id] || "")} />
                )}
              </Field>
            ))}
          </div>
        </Surface>
      ) : null}

      <Surface className="p-5">
        <h2 className="text-lg font-semibold text-foreground">{t(locale, "notesCredentials")}</h2>
        <FieldDescription className="mb-4 mt-1">{t(locale, "notesCredentialsDescription")}</FieldDescription>
        <RichNotesEditor defaultValue={item?.notes || ""} ariaLabel={t(locale, "notesCredentials")} locale={locale} />
      </Surface>

      <div className="flex gap-3">
        <Button>{t(locale, "saveEntry")}</Button>
        <Button asChild variant="outline">
          <Link href={`/app/items?workspace=${workspaceId}`}>{t(locale, "cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}
