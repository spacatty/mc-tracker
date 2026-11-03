"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  Copy,
  CopyPlus,
  History,
  Loader2,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  archiveItemAction,
  deleteItemAction,
  getEntryHistoryAction,
  payEntryAction,
  restoreItemAction,
  saveEntryBatchAction,
} from "@/app/actions";
import { rowFromEntry, rowToLine, type CaptureEntryRef } from "@/lib/capture/syntax";
import type { Locale } from "@/lib/i18n";
import type { Category, CategoryField, EntryDraft, PaymentItem, VendorSuggestion } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { useCapture } from "../capture/capture-provider";
import { CategoryList, CommitInput, CurrencySelect, PeriodPicker, addPeriodIso, inputClass, type PeriodValue } from "../capture/editors";
import {
  Kbd,
  billingSentence,
  daysBetween,
  monthlyEquivalent,
  periodWord,
  relativeDays,
  shortDate,
  todayIso,
  tx,
  urgencyTone,
} from "../capture/shared";
import { AppIcon } from "../icons";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type HistoryRow = Awaited<ReturnType<typeof getEntryHistoryAction>>[number];

function entryRef(item: PaymentItem): CaptureEntryRef {
  return {
    id: item.id,
    name: item.name,
    vendorName: item.vendorName,
    vendorUrl: item.vendorUrl,
    accountName: item.accountName,
    categoryId: item.categoryId,
    paymentType: item.paymentType,
    amount: item.amount,
    currency: item.currency,
    period: item.period,
    customPeriodDays: item.customPeriodDays,
    billingStartAt: item.billingStartAt,
    billingEndAt: item.billingEndAt,
    notes: item.notes,
    customFields: item.customFields,
  };
}

function draftFrom(item: PaymentItem): EntryDraft {
  return {
    rowKey: `inspector-${item.id}`,
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    paymentType: item.paymentType,
    amount: item.amount,
    currency: item.currency,
    billingStartAt: item.billingStartAt?.slice(0, 10) || null,
    billingEndAt: item.billingEndAt?.slice(0, 10) || null,
    period: item.paymentType === "recurring" ? item.period || "1m" : null,
    customPeriodDays: item.period === "custom" ? item.customPeriodDays || 30 : null,
    vendorName: item.vendorName,
    vendorUrl: item.vendorUrl,
    accountName: item.accountName,
    notes: item.notes,
    customFields: item.customFields,
  };
}

function plainNotes(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Progress ring for the current billing period. */
function RenewalRing({ progress, tone }: { progress: number; tone: string }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (
    <svg viewBox="0 0 48 48" className={cn("h-12 w-12 -rotate-90", tone)}>
      <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

function PropertyRow({
  label,
  children,
  editor,
  editable,
  copyValue,
  locale,
}: {
  label: string;
  children: ReactNode;
  editor?: (close: () => void) => ReactNode;
  editable: boolean;
  copyValue?: string;
  locale: Locale;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="group grid min-h-10 grid-cols-[8.5rem_1fr] items-center gap-2 rounded-lg px-2 transition hover:bg-white/[0.03]">
      <span className="truncate text-[13px] text-zinc-500">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        {editing && editor ? (
          <div className="w-full py-1">{editor(() => setEditing(false))}</div>
        ) : (
          <>
            <button
              type="button"
              disabled={!editable || !editor}
              onClick={() => setEditing(true)}
              className={cn("min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-sm text-zinc-100 transition", editable && editor && "hover:bg-white/[0.06]")}
            >
              {children}
            </button>
            {copyValue ? (
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(copyValue); toast(tx(locale, "Copied", "Скопировано")); }}
                className="rounded-md p-1 text-zinc-600 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-200 group-hover:opacity-100"
                aria-label={tx(locale, "Copy", "Копировать")}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

const empty = <span className="text-zinc-600">—</span>;

export function EntryInspector({
  item,
  categories,
  vendorSuggestions,
  workspaceId,
  readOnly,
  locale,
  position,
  onClose,
  onNavigate,
}: {
  item: PaymentItem | null;
  categories: Category[];
  vendorSuggestions: VendorSuggestion[];
  workspaceId: number;
  readOnly: boolean;
  locale: Locale;
  position: { index: number; total: number } | null;
  onClose: () => void;
  onNavigate: (direction: 1 | -1) => void;
}) {
  const router = useRouter();
  const { openCapture } = useCapture();
  const itemKey = item ? `${item.id}:${item.updatedAt}` : "";
  // Optimistic copy while a save is in flight; the server copy wins once it changes.
  const [pending, setPending] = useState<{ key: string; value: PaymentItem } | null>(null);
  const local = pending && pending.key === itemKey ? pending.value : item;
  const [savedTick, setSavedTick] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [history, setHistory] = useState<{ key: string; rows: HistoryRow[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isActing, startActing] = useTransition();
  const historyRows = history && history.key === itemKey ? history.rows : null;

  useEffect(() => {
    if (!item) return;
    let active = true;
    const key = `${item.id}:${item.updatedAt}`;
    getEntryHistoryAction(workspaceId, item.id)
      .then((rows) => { if (active) setHistory({ key, rows }); })
      .catch(() => { if (active) setHistory({ key, rows: [] }); });
    return () => { active = false; };
  }, [item, workspaceId]);

  useEffect(() => {
    if (!item) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      if (event.key === "ArrowDown" || event.key === "j") { event.preventDefault(); onNavigate(1); }
      if (event.key === "ArrowUp" || event.key === "k") { event.preventDefault(); onNavigate(-1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onNavigate]);

  const category = useMemo(() => categories.find((candidate) => candidate.id === local?.categoryId), [categories, local?.categoryId]);

  if (!item || !local) {
    return <Dialog.Root open={false} />;
  }

  const entry = local;
  const color = category?.color || "#71717a";
  const customDays = entry.customPeriodDays || 30;
  const periodValue: PeriodValue = { paymentType: entry.paymentType, period: entry.period, customDays };
  const today = todayIso();
  const end = entry.billingEndAt?.slice(0, 10) || null;
  const start = entry.billingStartAt?.slice(0, 10) || null;
  const daysLeft = end ? daysBetween(today, end) : null;
  const span = start && end ? Math.max(daysBetween(start, end), 1) : null;
  const progress = span && start ? daysBetween(start, today) / span : 0;
  const monthly = monthlyEquivalent(entry.amount, entry.paymentType, entry.period, customDays);
  const editable = !readOnly;
  const captureLine = rowToLine(rowFromEntry(entryRef(entry)), { categories, defaultCategoryId: null });
  const vendorNames = [...new Set(vendorSuggestions.map((vendor) => vendor.vendorName).filter(Boolean))];

  function save(patch: Partial<PaymentItem>) {
    const next = { ...entry, ...patch } as PaymentItem;
    setPending({ key: itemKey, value: next });
    setSaveError("");
    startSaving(async () => {
      const result = await saveEntryBatchAction({ workspaceId, rows: [draftFrom(next)] });
      if (!result.success) {
        setPending(null);
        setSaveError(result.rowErrors[0]?.message || result.message || tx(locale, "Could not save.", "Не удалось сохранить."));
        return;
      }
      setSavedTick((tick) => tick + 1);
      router.refresh();
    });
  }

  function itemForm() {
    const formData = new FormData();
    formData.set("id", String(entry.id));
    formData.set("workspaceId", String(workspaceId));
    return formData;
  }

  function markPaid() {
    startActing(async () => {
      const formData = itemForm();
      formData.set("paymentDate", today);
      await payEntryAction(formData);
      toast.success(tx(locale, `Payment recorded for ${entry.name}`, `Оплата записана: ${entry.name}`), {
        description: entry.paymentType === "recurring" ? tx(locale, "Renewal date moved forward one period.", "Дата продления сдвинута на период.") : undefined,
      });
      router.refresh();
    });
  }

  function archive() {
    startActing(async () => {
      await archiveItemAction(itemForm());
      onClose();
      router.refresh();
      toast(tx(locale, `${entry.name} archived`, `${entry.name} в архиве`), {
        action: {
          label: tx(locale, "Undo", "Отменить"),
          onClick: async () => { await restoreItemAction(itemForm()); router.refresh(); },
        },
      });
    });
  }

  function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startActing(async () => {
      await deleteItemAction(itemForm());
      onClose();
      router.refresh();
      toast(tx(locale, `${entry.name} deleted`, `${entry.name} удалена`));
    });
  }

  function fieldDisplay(field: CategoryField) {
    const value = entry.customFields?.[field.id];
    if (value === undefined || value === null || value === "") return empty;
    if (field.type === "checkbox") return value ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет");
    if (field.type === "url") return <span className="text-sky-300">{String(value).replace(/^https?:\/\//, "")}</span>;
    return <span className={cn(field.bold && "font-semibold")} style={{ color: field.color || undefined }}>{String(value)}</span>;
  }

  function fieldEditor(field: CategoryField) {
    const value = entry.customFields?.[field.id];
    const setValue = (next: unknown) => save({ customFields: { ...entry.customFields, [field.id]: next } });
    // eslint-disable-next-line react/display-name
    return (close: () => void) => {
      if (field.type === "checkbox") {
        return (
          <div className="flex gap-1">
            {[true, false].map((option) => (
              <button key={String(option)} type="button" className={cn("flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm", Boolean(value) === option && "bg-violet-500/20")} onClick={() => { setValue(option); close(); }}>
                {option ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет")}
              </button>
            ))}
          </div>
        );
      }
      if (field.type === "select" && field.options?.length) {
        return (
          <select autoFocus className={inputClass} defaultValue={String(value ?? "")} onChange={(event) => { setValue(event.target.value); close(); }} onBlur={close}>
            <option value="" className="bg-zinc-900">—</option>
            {field.options.map((option) => <option key={option} value={option} className="bg-zinc-900">{option}</option>)}
          </select>
        );
      }
      return (
        <CommitInput
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
          value={String(value ?? "")}
          onCommit={(next) => { setValue(next); close(); }}
          onCancel={close}
        />
      );
    };
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement | null;
            // Quick capture (opened from here) sits on top; working in it keeps the panel.
            if (target?.closest("[role=dialog]")) { event.preventDefault(); return; }
            // Clicking another row in the table switches entries instead of closing.
            if (target?.closest("[data-entry-row]") || target?.closest("[data-radix-popper-content-wrapper]") || target?.closest("[data-sonner-toaster]")) event.preventDefault();
          }}
          className="inspector-in fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-[460px] flex-col border-l border-white/10 bg-[#0b0b10]/95 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.7)] outline-none backdrop-blur-xl"
        >

          {/* Top bar */}
          <div className="relative flex items-center gap-1 px-4 pt-3">
            <button type="button" onClick={() => onNavigate(-1)} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Previous", "Предыдущая")}><ChevronUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => onNavigate(1)} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Next", "Следующая")}><ChevronDown className="h-4 w-4" /></button>
            {position ? <span className="ml-1 text-xs tabular-nums text-zinc-600">{position.index + 1} / {position.total}</span> : null}
            <span className="ml-2 hidden items-center gap-1 text-[11px] text-zinc-600 sm:flex"><Kbd>J</Kbd><Kbd>K</Kbd></span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{tx(locale, "Saving", "Сохранение")}</> : savedTick ? <span key={savedTick} className="saved-pop flex items-center gap-1 text-emerald-300"><Check className="h-3.5 w-3.5" />{tx(locale, "Saved", "Сохранено")}</span> : null}
            </span>
            <Dialog.Close className="ml-1 rounded-md p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Close", "Закрыть")}><X className="h-4 w-4" /></Dialog.Close>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-8">
            {/* Identity */}
            <div className="mt-4 flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" disabled={!editable} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-xs font-medium transition hover:border-white/25" style={{ color, background: `${color}14` }}>
                    <AppIcon name={category?.icon || "CircleDashed"} className="h-3.5 w-3.5" />
                    {category?.name || tx(locale, "No category", "Без категории")}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64">
                  <CategoryList categories={categories} value={entry.categoryId} locale={locale} onSelect={(categoryId) => save({ categoryId })} />
                </PopoverContent>
              </Popover>
              {entry.paymentType === "recurring" ? <span className="text-xs text-zinc-500">{billingSentence(entry.paymentType, entry.period, customDays, locale)}</span> : null}
            </div>
            <Dialog.Title asChild>
              <input
                key={`name-${entry.id}-${item.updatedAt}`}
                defaultValue={entry.name}
                readOnly={!editable}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = entry.name; event.currentTarget.blur(); } }}
                onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== entry.name) save({ name }); else event.target.value = entry.name; }}
                className="mt-2 w-full bg-transparent text-[26px] font-semibold tracking-tight text-white outline-none placeholder:text-zinc-600 focus:underline focus:decoration-violet-400/40 focus:decoration-2 focus:underline-offset-8"
              />
            </Dialog.Title>
            {entry.vendorName || entry.accountName ? (
              <p className="mt-1 truncate text-sm text-zinc-400">
                {entry.vendorName}
                {entry.accountName ? <span className="text-zinc-500"> · {entry.accountName}</span> : null}
              </p>
            ) : null}
            {saveError ? <p className="mt-2 text-sm text-red-300">{saveError}</p> : null}

            {/* Hero stats */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" disabled={!editable} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.05]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{tx(locale, "Price", "Цена")}</p>
                    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white">{formatMoney(entry.amount, entry.currency)}</p>
                    <p className="text-xs text-zinc-500">
                      {entry.paymentType === "recurring" ? `/ ${periodWord(entry.paymentType, entry.period, customDays, locale)}` : tx(locale, "one-time", "разово")}
                      {monthly && entry.period !== "1m" ? ` · ≈ ${formatMoney(monthly, entry.currency)}/${tx(locale, "mo", "мес")}` : ""}
                    </p>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72">
                  <InspectorPriceEditor
                    amount={entry.amount}
                    currency={entry.currency}
                    period={periodValue}
                    locale={locale}
                    onSave={(next) => save({
                      amount: next.amount,
                      currency: next.currency,
                      paymentType: next.period.paymentType,
                      period: next.period.paymentType === "recurring" ? next.period.period : null,
                      customPeriodDays: next.period.period === "custom" ? next.period.customDays : null,
                    })}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                {entry.paymentType === "recurring" && end ? (
                  <>
                    <RenewalRing progress={progress} tone={urgencyTone(daysLeft)} />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{tx(locale, "Renews", "Продление")}</p>
                      <p className={cn("mt-1 text-base font-semibold", urgencyTone(daysLeft))}>{daysLeft !== null ? relativeDays(daysLeft, locale) : "—"}</p>
                      <p className="text-xs text-zinc-500">{shortDate(end, locale, true)}</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{tx(locale, "Paid", "Оплачено")}</p>
                    <p className="mt-1 text-base font-semibold text-zinc-200">{shortDate(start, locale, true)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {editable ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ActionButton onClick={markPaid} disabled={isActing} tone="emerald" icon={<CircleCheckBig className="h-4 w-4" />}>{tx(locale, "Mark paid", "Оплачено")}</ActionButton>
                <ActionButton onClick={() => openCapture({ text: rowToLine({ ...rowFromEntry(entryRef(entry)), name: `${entry.name} copy` }, { categories, defaultCategoryId: null }) })} icon={<CopyPlus className="h-4 w-4" />}>{tx(locale, "Duplicate", "Дублировать")}</ActionButton>
                <ActionButton onClick={() => openCapture({ text: rowToLine({ ...rowFromEntry(entryRef(entry)), action: "edit", targetItemId: entry.id }, { categories, defaultCategoryId: null }) })} icon={<Terminal className="h-4 w-4" />}>{tx(locale, "Edit as text", "Как текст")}</ActionButton>
                <ActionButton onClick={archive} disabled={isActing} icon={<Archive className="h-4 w-4" />}>{tx(locale, "Archive", "В архив")}</ActionButton>
                <ActionButton onClick={remove} disabled={isActing} tone={confirmDelete ? "red" : "default"} icon={<Trash2 className="h-4 w-4" />}>{confirmDelete ? tx(locale, "Click to confirm", "Точно удалить?") : tx(locale, "Delete", "Удалить")}</ActionButton>
              </div>
            ) : null}

            {/* Properties */}
            <Section title={tx(locale, "Properties", "Свойства")}>
              <PropertyRow label={tx(locale, "Vendor", "Поставщик")} editable={editable} locale={locale} editor={(close) => (
                <>
                  <CommitInput value={entry.vendorName} list="inspector-vendors" onCommit={(vendorName) => { const known = vendorSuggestions.find((vendor) => vendor.vendorName === vendorName); save({ vendorName, vendorUrl: entry.vendorUrl || known?.vendorUrl || "" }); close(); }} onCancel={close} />
                  <datalist id="inspector-vendors">{vendorNames.map((name) => <option key={name} value={name} />)}</datalist>
                </>
              )}>
                {entry.vendorName || empty}
              </PropertyRow>
              <PropertyRow label={tx(locale, "Account", "Аккаунт")} editable={editable} locale={locale} copyValue={entry.accountName || undefined} editor={(close) => (
                <CommitInput value={entry.accountName} onCommit={(accountName) => { save({ accountName }); close(); }} onCancel={close} />
              )}>
                {entry.accountName || empty}
              </PropertyRow>
              <PropertyRow label={tx(locale, "Panel URL", "Ссылка")} editable={editable} locale={locale} editor={(close) => (
                <CommitInput type="url" value={entry.vendorUrl} placeholder="https://" onCommit={(vendorUrl) => { save({ vendorUrl }); close(); }} onCancel={close} />
              )}>
                {entry.vendorUrl ? (
                  <span className="inline-flex max-w-full items-center gap-1 text-sky-300">
                    <span className="truncate">{entry.vendorUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                    <a href={entry.vendorUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="shrink-0 rounded p-0.5 hover:bg-sky-500/15"><ArrowUpRight className="h-3.5 w-3.5" /></a>
                  </span>
                ) : empty}
              </PropertyRow>
              <PropertyRow label={tx(locale, "Billing", "Оплата")} editable={editable} locale={locale} editor={(close) => (
                <InlinePeriod value={periodValue} locale={locale} onSave={(next) => {
                  save({
                    paymentType: next.paymentType,
                    period: next.paymentType === "recurring" ? next.period : null,
                    customPeriodDays: next.period === "custom" ? next.customDays : null,
                    billingEndAt: next.paymentType === "recurring" && start ? addPeriodIso(start, next) : entry.billingEndAt,
                  });
                  close();
                }} onCancel={close} />
              )}>
                {billingSentence(entry.paymentType, entry.period, customDays, locale)}
              </PropertyRow>
              <PropertyRow label={entry.paymentType === "recurring" ? tx(locale, "Period started", "Начало периода") : tx(locale, "Paid on", "Дата оплаты")} editable={editable} locale={locale} editor={(close) => (
                <CommitInput type="date" selectOnFocus={false} value={start || ""} onCommit={(value) => { save({ billingStartAt: value || null, billingEndAt: entry.paymentType === "recurring" && value ? addPeriodIso(value, periodValue) : entry.billingEndAt }); close(); }} onCancel={close} />
              )}>
                {start ? shortDate(start, locale, true) : empty}
              </PropertyRow>
              {entry.paymentType === "recurring" ? (
                <PropertyRow label={tx(locale, "Renews on", "Продление")} editable={editable} locale={locale} editor={(close) => (
                  <CommitInput type="date" selectOnFocus={false} value={end || ""} onCommit={(value) => { save({ billingEndAt: value || null }); close(); }} onCancel={close} />
                )}>
                  {end ? <>{shortDate(end, locale, true)} <span className={cn("ml-1 text-xs", urgencyTone(daysLeft))}>{daysLeft !== null ? relativeDays(daysLeft, locale) : ""}</span></> : empty}
                </PropertyRow>
              ) : null}
              {category?.fields.map((field) => (
                <PropertyRow
                  key={field.id}
                  label={field.label}
                  editable={editable}
                  locale={locale}
                  copyValue={field.copyable !== false && entry.customFields?.[field.id] ? String(entry.customFields[field.id]) : undefined}
                  editor={fieldEditor(field)}
                >
                  {fieldDisplay(field)}
                </PropertyRow>
              ))}
            </Section>

            {/* Notes */}
            <Section title={tx(locale, "Notes", "Заметки")}>
              <textarea
                key={`notes-${entry.id}-${item.updatedAt}`}
                defaultValue={plainNotes(entry.notes)}
                readOnly={!editable}
                placeholder={tx(locale, "Anything worth remembering…", "Что стоит запомнить…")}
                rows={Math.min(Math.max(plainNotes(entry.notes).split("\n").length, 2), 8)}
                onBlur={(event) => { if (event.target.value !== plainNotes(entry.notes)) save({ notes: event.target.value }); }}
                className="w-full resize-none rounded-xl border border-transparent bg-white/[0.02] px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-600 hover:border-white/10 focus:border-violet-400/40 focus:bg-violet-500/[0.04]"
              />
            </Section>

            {/* History */}
            <Section title={tx(locale, "Payments", "Платежи")} icon={<History className="h-3.5 w-3.5" />}>
              {historyRows === null ? (
                <div className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />
              ) : historyRows.length ? (
                <ol className="relative ml-2 space-y-3 border-l border-white/10 pl-4">
                  {historyRows.map((payment) => (
                    <li key={payment.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-emerald-400" />
                      <p className="text-sm text-zinc-200">{formatMoney(payment.amount, payment.currency)}</p>
                      <p className="text-xs text-zinc-500">{shortDate(payment.paymentDate, locale, true)}{payment.dueDate ? ` → ${shortDate(payment.dueDate, locale, true)}` : ""}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-2 text-sm text-zinc-600">{tx(locale, "No payments recorded yet. “Mark paid” adds one and moves the renewal date.", "Платежей пока нет. «Оплачено» добавит платёж и сдвинет дату продления.")}</p>
              )}
            </Section>

            {/* Capture line */}
            <Section title={tx(locale, "As a capture line", "Как строка ввода")} icon={<Terminal className="h-3.5 w-3.5" />}>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(captureLine); toast(tx(locale, "Line copied", "Строка скопирована")); }}
                className="group w-full rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5 text-left font-mono text-[12px] leading-relaxed text-zinc-400 transition hover:border-white/15 hover:text-zinc-200"
              >
                {captureLine}
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-600 group-hover:text-violet-300"><Copy className="h-3 w-3" />{tx(locale, "copy", "копировать")}</span>
              </button>
            </Section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="mt-7">
      <p className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{icon}{title}</p>
      {children}
    </section>
  );
}

function ActionButton({ children, icon, onClick, disabled, tone = "default" }: { children: ReactNode; icon: ReactNode; onClick: () => void; disabled?: boolean; tone?: "default" | "emerald" | "red" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition active:scale-[0.97] disabled:opacity-50",
        tone === "emerald" && "border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
        tone === "red" && "border-red-400/40 bg-red-500/15 text-red-100 hover:bg-red-500/25",
        tone === "default" && "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function InlinePeriod({ value, locale, onSave, onCancel }: { value: PeriodValue; locale: Locale; onSave: (value: PeriodValue) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="space-y-2">
      <PeriodPicker value={draft} onChange={(next) => { setDraft(next); if (next.period !== "custom") onSave(next); }} locale={locale} />
      {draft.period === "custom" ? (
        <div className="flex gap-1">
          <button type="button" className="h-7 flex-1 rounded-md bg-violet-500/25 text-xs text-violet-50" onClick={() => onSave(draft)}>{tx(locale, "Done", "Готово")}</button>
          <button type="button" className="h-7 rounded-md px-2 text-xs text-zinc-400" onClick={onCancel}>{tx(locale, "Cancel", "Отмена")}</button>
        </div>
      ) : null}
    </div>
  );
}

function InspectorPriceEditor({ amount, currency, period, locale, onSave }: { amount: number; currency: string; period: PeriodValue; locale: Locale; onSave: (value: { amount: number; currency: string; period: PeriodValue }) => void }) {
  const [amountDraft, setAmountDraft] = useState(String(amount));
  const [currencyDraft, setCurrencyDraft] = useState(currency);
  const [periodDraft, setPeriodDraft] = useState(period);
  const valid = Number.isFinite(Number(amountDraft.replace(",", "."))) && Number(amountDraft.replace(",", ".")) >= 0;
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (valid) onSave({ amount: Number(amountDraft.replace(",", ".")), currency: currencyDraft, period: periodDraft }); }}>
      <div className="flex gap-2">
        <input autoFocus inputMode="decimal" className={cn(inputClass, "text-base font-semibold tabular-nums", !valid && "border-red-400/50")} value={amountDraft} onChange={(event) => setAmountDraft(event.target.value)} />
        <CurrencySelect value={currencyDraft} onChange={setCurrencyDraft} />
      </div>
      <PeriodPicker value={periodDraft} onChange={setPeriodDraft} locale={locale} />
      <button type="submit" disabled={!valid} className="h-8 w-full rounded-lg bg-violet-500/25 text-sm font-medium text-violet-50 transition hover:bg-violet-500/35 disabled:opacity-50">{tx(locale, "Save", "Сохранить")}</button>
    </form>
  );
}
