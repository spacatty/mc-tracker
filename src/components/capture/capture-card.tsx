"use client";

import { AlertTriangle, ArrowUpRight, CalendarClock, CircleDollarSign, Link2, NotebookPen, Plus, Receipt, RefreshCw, Store, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CaptureContext, ParsedLine } from "@/lib/capture/syntax";
import type { ImportRow, ImportRowErrors } from "@/lib/import/rows";
import type { Locale } from "@/lib/i18n";
import { cn, formatMoney } from "@/lib/utils";
import { AppIcon } from "../icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CategoryList, CommitInput, CurrencySelect, PeriodPicker, addPeriodIso, inputClass, type PeriodValue } from "./editors";
import { Chip, daysBetween, monthlyEquivalent, periodWord, relativeDays, shortDate, todayIso, tx, urgencyTone } from "./shared";

function EditorPopover({ trigger, children, width = "w-72", title }: { trigger: ReactNode; children: (close: () => void) => ReactNode; width?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className={cn("space-y-3 border-white/10 bg-zinc-950/95 backdrop-blur-xl", width)} onOpenAutoFocus={(event) => event.preventDefault()}>
        {title ? <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{title}</p> : null}
        {open ? children(() => setOpen(false)) : null}
      </PopoverContent>
    </Popover>
  );
}

export function CaptureCard({
  parsed,
  context,
  errors,
  locale,
  onChange,
  onRemove,
  onOpenExisting,
  index,
}: {
  parsed: ParsedLine;
  context: CaptureContext;
  errors: ImportRowErrors;
  locale: Locale;
  onChange: (row: ImportRow) => void;
  onRemove: () => void;
  onOpenExisting?: (id: number) => void;
  index: number;
}) {
  const { row, assumed, duplicateOf, target } = parsed;
  const category = context.categories.find((candidate) => candidate.id === row.categoryId);
  const color = category?.color || "#71717a";
  const amount = Number(row.amountInput || 0);
  const customDays = Number(row.customPeriodDaysInput) || 30;
  const periodValue: PeriodValue = { paymentType: row.paymentType, period: row.period, customDays };
  const daysLeft = row.billingEndAt ? daysBetween(todayIso(), row.billingEndAt) : null;
  const monthly = monthlyEquivalent(amount, row.paymentType, row.period, customDays);
  const patch = (next: Partial<ImportRow>) => onChange({ ...row, ...next });
  const vendorNames = [...new Set(context.vendors.map((vendor) => vendor.vendorName).filter(Boolean))];
  const accounts = [...new Set(context.vendors.filter((vendor) => !row.vendorName || vendor.vendorName === row.vendorName).map((vendor) => vendor.accountName).filter(Boolean))];
  const hasErrors = Object.keys(errors).length > 0;
  const isPay = row.action === "pay";
  const isEdit = row.action === "edit";

  return (
    <div
      className={cn(
        "capture-card-in group relative overflow-hidden rounded-xl border bg-white/[0.02] p-5 transition",
        hasErrors ? "border-red-400/40" : "border-white/[0.08] hover:border-white/15",
      )}
      style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
    >

      <div className="relative flex items-start gap-3">
        <EditorPopover
          title={tx(locale, "Category", "Категория")}
          width="w-64"
          trigger={
            <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.07]" style={{ color }} title={tx(locale, "Change category", "Сменить категорию")}>
              {isPay ? <Receipt className="h-5 w-5" /> : <AppIcon name={category?.icon || "CircleDashed"} className="h-5 w-5" />}
            </button>
          }
        >
          {(close) => <CategoryList categories={context.categories} value={row.categoryId} locale={locale} onSelect={(id) => { patch({ categoryId: id }); close(); }} />}
        </EditorPopover>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isPay ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">{tx(locale, "Payment", "Оплата")}</span> : null}
            {isEdit ? <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-200">{tx(locale, "Update", "Изменение")}</span> : null}
            <EditorPopover
              title={tx(locale, "Name", "Название")}
              trigger={
                <button type="button" className={cn("min-w-0 truncate text-left text-lg font-semibold tracking-tight transition hover:text-white", row.name ? "text-zinc-50" : "italic text-red-300/80")}>
                  {row.name || tx(locale, "Needs a name", "Нужно название")}
                </button>
              }
            >
              {(close) => <CommitInput value={row.name} onCommit={(name) => { patch({ name }); close(); }} onCancel={close} />}
            </EditorPopover>
          </div>
          <EditorPopover
            title={tx(locale, "Vendor & account", "Поставщик и аккаунт")}
            trigger={
              <button type="button" className="mt-0.5 flex max-w-full items-center gap-1.5 truncate text-sm text-zinc-400 transition hover:text-zinc-200">
                {row.vendorName || row.accountName ? (
                  <>
                    <Store className="h-3.5 w-3.5 shrink-0 text-sky-300/70" />
                    <span className="truncate">{row.vendorName || "—"}</span>
                    {row.accountName ? <span className="truncate text-zinc-500">· {row.accountName}</span> : null}
                  </>
                ) : (
                  <span className="text-zinc-600">{tx(locale, "+ vendor", "+ поставщик")}</span>
                )}
              </button>
            }
          >
            {(close) => (
              <VendorEditor
                vendor={row.vendorName}
                account={row.accountName}
                vendorNames={vendorNames}
                accounts={accounts}
                locale={locale}
                onSave={(vendorName, accountName) => {
                  const known = context.vendors.find((vendor) => vendor.vendorName.toLowerCase() === vendorName.toLowerCase());
                  patch({ vendorName, accountName, vendorUrl: row.vendorUrl || known?.vendorUrl || "" });
                  close();
                }}
              />
            )}
          </EditorPopover>
        </div>

        <EditorPopover
          title={tx(locale, "Price", "Цена")}
          trigger={
            <button type="button" className="shrink-0 rounded-xl px-2 py-1 text-right transition hover:bg-white/[0.05]">
              {assumed.has("amount") && !isPay ? (
                <span className="text-sm font-medium text-amber-300/90">{tx(locale, "+ price", "+ цена")}</span>
              ) : (
                <span className="block text-lg font-semibold tabular-nums text-zinc-50">
                  {formatMoney(amount, row.currency)}
                  <span className="ml-1 text-xs font-medium text-zinc-500">/{periodWord(row.paymentType, row.period, customDays, locale, true)}</span>
                </span>
              )}
              {monthly && row.period !== "1m" && !assumed.has("amount") ? (
                <span className="block text-[11px] text-zinc-500">≈ {formatMoney(monthly, row.currency)}/{tx(locale, "mo", "мес")}</span>
              ) : null}
            </button>
          }
        >
          {(close) => (
            <PriceEditor
              amount={row.amountInput}
              currency={row.currency}
              period={periodValue}
              locale={locale}
              onSave={(next) => {
                const shiftEnd = row.billingStartAt && !isPay ? addPeriodIso(row.billingStartAt, next.period) : row.billingEndAt;
                patch({
                  amountInput: next.amount,
                  currency: next.currency,
                  paymentType: next.period.paymentType,
                  period: next.period.paymentType === "recurring" ? next.period.period : null,
                  customPeriodDaysInput: String(next.period.customDays),
                  billingEndAt: next.period.paymentType === "recurring" ? shiftEnd : row.billingEndAt,
                });
                close();
              }}
            />
          )}
        </EditorPopover>

        <button type="button" onClick={onRemove} className="-mr-1 -mt-1 rounded-lg p-1 text-zinc-600 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-200 group-hover:opacity-100" aria-label={tx(locale, "Remove", "Убрать")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2 pl-14">
        {isPay ? (
          <EditorPopover
            title={tx(locale, "Paid on", "Дата оплаты")}
            width="w-60"
            trigger={<Chip tone="emerald" icon={<CalendarClock className="h-3.5 w-3.5" />} muted={assumed.has("dates")}>{tx(locale, "Paid", "Оплачено")} {shortDate(row.billingStartAt, locale)}{target ? ` · ${target.name}` : ""}</Chip>}
          >
            {(close) => <CommitInput type="date" value={row.billingStartAt} selectOnFocus={false} onCommit={(value) => { patch({ billingStartAt: value }); close(); }} onCancel={close} />}
          </EditorPopover>
        ) : (
          <EditorPopover
            title={tx(locale, "Dates", "Даты")}
            width="w-80"
            trigger={
              <Chip tone="amber" icon={row.paymentType === "recurring" ? <RefreshCw className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />} muted={assumed.has("dates")}>
                {row.paymentType === "recurring" ? (
                  <>
                    {shortDate(row.billingStartAt, locale)} → {shortDate(row.billingEndAt, locale)}
                    {daysLeft !== null ? <span className={cn("ml-1", urgencyTone(daysLeft))}>· {relativeDays(daysLeft, locale)}</span> : null}
                  </>
                ) : (
                  <>{tx(locale, "Paid", "Оплачено")} {shortDate(row.billingStartAt, locale)}</>
                )}
              </Chip>
            }
          >
            {(close) => (
              <DatesEditor
                start={row.billingStartAt}
                end={row.billingEndAt}
                period={periodValue}
                locale={locale}
                onSave={(billingStartAt, billingEndAt) => {
                  patch({ billingStartAt, billingEndAt });
                  close();
                }}
              />
            )}
          </EditorPopover>
        )}

        {category?.fields.map((field) => {
          const value = row.customFields[field.id];
          const filled = value !== undefined && value !== null && value !== "" && value !== false;
          return (
            <EditorPopover
              key={field.id}
              title={field.label}
              trigger={
                <Chip tone={filled ? "fuchsia" : "ghost"} className={cn(errors[`customFields.${field.id}`] && "border-red-400/60 text-red-200")}>
                  {filled ? (
                    <>
                      <span className="text-zinc-500">{field.label}</span> {field.type === "checkbox" ? tx(locale, "yes", "да") : String(value)}
                    </>
                  ) : (
                    <>
                      <Plus className="-ml-0.5 inline h-3 w-3" /> {field.label}
                      {field.required ? <span className="text-red-300">*</span> : null}
                    </>
                  )}
                </Chip>
              }
            >
              {(close) =>
                field.type === "select" && field.options?.length ? (
                  <div className="space-y-1">
                    {field.options.map((option) => (
                      <button key={option} type="button" className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/[0.06]" onClick={() => { patch({ customFields: { ...row.customFields, [field.id]: option } }); close(); }}>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : field.type === "checkbox" ? (
                  <div className="flex gap-2">
                    {[true, false].map((option) => (
                      <button key={String(option)} type="button" className={cn("flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm", Boolean(value) === option && "bg-violet-500/20")} onClick={() => { patch({ customFields: { ...row.customFields, [field.id]: option } }); close(); }}>
                        {option ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет")}
                      </button>
                    ))}
                  </div>
                ) : (
                  <CommitInput
                    type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                    value={filled ? String(value) : ""}
                    onCommit={(next) => { patch({ customFields: { ...row.customFields, [field.id]: next } }); close(); }}
                    onCancel={close}
                  />
                )
              }
            </EditorPopover>
          );
        })}

        <EditorPopover
          title={tx(locale, "Panel / vendor URL", "Ссылка на панель")}
          trigger={
            <Chip tone={row.vendorUrl ? "default" : "ghost"} icon={<Link2 className="h-3.5 w-3.5" />} className={cn(errors.vendorUrl && "border-red-400/60 text-red-200")}>
              {row.vendorUrl ? row.vendorUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : tx(locale, "link", "ссылка")}
            </Chip>
          }
        >
          {(close) => <CommitInput type="url" placeholder="https://" value={row.vendorUrl} onCommit={(vendorUrl) => { patch({ vendorUrl }); close(); }} onCancel={close} />}
        </EditorPopover>

        <EditorPopover
          title={tx(locale, "Notes", "Заметки")}
          trigger={
            <Chip tone={row.notes ? "default" : "ghost"} icon={<NotebookPen className="h-3.5 w-3.5" />} className="max-w-[16rem]">
              {row.notes ? row.notes.replace(/\s+/g, " ") : tx(locale, "note", "заметка")}
            </Chip>
          }
        >
          {(close) => <NotesEditor value={row.notes} locale={locale} onSave={(notes) => { patch({ notes }); close(); }} />}
        </EditorPopover>
      </div>

      {duplicateOf || hasErrors || (row.action !== "create" && !target) ? (
        <div className="relative mt-3 space-y-1 pl-14">
          {duplicateOf ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-200/90">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tx(locale, "You already track", "Уже есть запись")} <span className="font-semibold">{duplicateOf.name}</span>
              {onOpenExisting ? (
                <button type="button" className="inline-flex items-center gap-0.5 text-amber-100 underline-offset-2 hover:underline" onClick={() => onOpenExisting(duplicateOf.id)}>
                  {tx(locale, "open", "открыть")} <ArrowUpRight className="h-3 w-3" />
                </button>
              ) : null}
            </p>
          ) : null}
          {row.action !== "create" && !target ? (
            <p className="flex items-center gap-1.5 text-xs text-red-300"><AlertTriangle className="h-3.5 w-3.5" />{tx(locale, "That entry id does not exist in this workspace.", "Записи с таким id нет в этом пространстве.")}</p>
          ) : null}
          {Object.entries(errors).filter(([key]) => key !== "id").map(([key, message]) => (
            <p key={key} className="flex items-center gap-1.5 text-xs text-red-300"><AlertTriangle className="h-3.5 w-3.5" />{message}</p>
          ))}
        </div>
      ) : null}
      {row.hint ? <p className="relative mt-2 pl-14 text-xs text-zinc-500">✨ {row.hint}</p> : null}
    </div>
  );
}

function VendorEditor({ vendor, account, vendorNames, accounts, locale, onSave }: { vendor: string; account: string; vendorNames: string[]; accounts: string[]; locale: Locale; onSave: (vendor: string, account: string) => void }) {
  const [vendorDraft, setVendorDraft] = useState(vendor);
  const [accountDraft, setAccountDraft] = useState(account);
  const matches = vendorNames.filter((name) => name.toLowerCase().includes(vendorDraft.toLowerCase()) && name !== vendorDraft).slice(0, 5);
  return (
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onSave(vendorDraft.trim(), accountDraft.trim()); }}>
      <input autoFocus className={inputClass} placeholder={tx(locale, "Vendor (Hetzner, Namecheap…)", "Поставщик (Hetzner, Namecheap…)")} value={vendorDraft} onChange={(event) => setVendorDraft(event.target.value)} />
      {matches.length ? (
        <div className="flex flex-wrap gap-1">
          {matches.map((name) => <Chip key={name} tone="sky" onClick={() => setVendorDraft(name)}>{name}</Chip>)}
        </div>
      ) : null}
      <input className={inputClass} list="capture-account-options" placeholder={tx(locale, "Account / login", "Аккаунт / логин")} value={accountDraft} onChange={(event) => setAccountDraft(event.target.value)} />
      <datalist id="capture-account-options">{accounts.map((value) => <option key={value} value={value} />)}</datalist>
      <button type="submit" className="h-8 w-full rounded-lg bg-violet-500/25 text-sm font-medium text-violet-50 transition hover:bg-violet-500/35">{tx(locale, "Done", "Готово")}</button>
    </form>
  );
}

function PriceEditor({ amount, currency, period, locale, onSave }: { amount: string; currency: string; period: PeriodValue; locale: Locale; onSave: (value: { amount: string; currency: string; period: PeriodValue }) => void }) {
  const [amountDraft, setAmountDraft] = useState(amount);
  const [currencyDraft, setCurrencyDraft] = useState(currency);
  const [periodDraft, setPeriodDraft] = useState(period);
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSave({ amount: amountDraft.replace(",", "."), currency: currencyDraft, period: periodDraft }); }}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <CircleDollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300/60" />
          <input autoFocus inputMode="decimal" className={cn(inputClass, "pl-8 text-base font-semibold tabular-nums")} placeholder="0.00" value={amountDraft} onChange={(event) => setAmountDraft(event.target.value)} />
        </div>
        <CurrencySelect value={currencyDraft} onChange={setCurrencyDraft} />
      </div>
      <PeriodPicker value={periodDraft} onChange={setPeriodDraft} locale={locale} />
      <button type="submit" className="h-8 w-full rounded-lg bg-violet-500/25 text-sm font-medium text-violet-50 transition hover:bg-violet-500/35">{tx(locale, "Done", "Готово")}</button>
    </form>
  );
}

function DatesEditor({ start, end, period, locale, onSave }: { start: string; end: string; period: PeriodValue; locale: Locale; onSave: (start: string, end: string) => void }) {
  const [startDraft, setStartDraft] = useState(start);
  const [endDraft, setEndDraft] = useState(end);
  const today = todayIso();
  const recurring = period.paymentType === "recurring";
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSave(startDraft, endDraft); }}>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[11px] text-zinc-500">
          {recurring ? tx(locale, "Period started", "Начало периода") : tx(locale, "Paid on", "Дата оплаты")}
          <input type="date" className={inputClass} value={startDraft} onChange={(event) => { setStartDraft(event.target.value); if (recurring && event.target.value) setEndDraft(addPeriodIso(event.target.value, period)); }} />
        </label>
        {recurring ? (
          <label className="space-y-1 text-[11px] text-zinc-500">
            {tx(locale, "Renews / expires", "Продление")}
            <input type="date" className={inputClass} value={endDraft} onChange={(event) => setEndDraft(event.target.value)} />
          </label>
        ) : null}
      </div>
      {recurring ? (
        <div className="flex flex-wrap gap-1">
          <Chip onClick={() => { setStartDraft(today); setEndDraft(addPeriodIso(today, period)); }}>{tx(locale, "Starts today", "С сегодня")}</Chip>
          <Chip onClick={() => setEndDraft(addPeriodIso(startDraft || today, period))}>{tx(locale, "One period after start", "Через период")}</Chip>
        </div>
      ) : null}
      <button type="submit" className="h-8 w-full rounded-lg bg-violet-500/25 text-sm font-medium text-violet-50 transition hover:bg-violet-500/35">{tx(locale, "Done", "Готово")}</button>
    </form>
  );
}

function NotesEditor({ value, locale, onSave }: { value: string; locale: Locale; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <textarea autoFocus rows={3} className={cn(inputClass, "h-auto py-2")} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="submit" className="h-8 w-full rounded-lg bg-violet-500/25 text-sm font-medium text-violet-50 transition hover:bg-violet-500/35">{tx(locale, "Done", "Готово")}</button>
    </form>
  );
}
