"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CopyCheck,
  FileUp,
  Plus,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { analyzeAiImportAction, applyImportRowsAction } from "@/app/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import type { Locale } from "@/lib/i18n";
import type { AiDraftItem, AiQuestion } from "@/lib/ai/import-schema";
import {
  blankImportRow,
  entrySignature,
  importRowPayload,
  parseTabularInput,
  validateImportRow,
  type ImportRow,
  type ImportRowErrors,
} from "@/lib/import/rows";
import type { BillingPeriod, Category, CategoryField, EntryBatchRowError } from "@/lib/types";
import { cn, periodLabel } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input, Textarea } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Surface } from "./ui/surface";

export type ImportTargetEntry = {
  id: number;
  name: string;
  vendorName: string;
  accountName: string;
  categoryId: number | null;
};

type RowStatus = "ready" | "error" | "duplicate";
type RowFilter = "all" | "attention";

const PERIODS: BillingPeriod[] = ["7d", "1m", "3m", "1y", "custom"];
const CURRENCY_CODES: string[] = SUPPORTED_CURRENCIES.map((currency) => currency.code);
const ACCEPTED_FILES = ".csv,.tsv,.json,.txt,text/csv,application/json,text/plain";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

function rowFromAiDraft(draft: AiDraftItem, index: number): ImportRow {
  const row = blankImportRow(`ai-${Date.now()}-${index}`, "ai", draft.categoryId);
  return {
    ...row,
    action: draft.action,
    targetItemId: draft.targetItemId,
    name: draft.name,
    paymentType: draft.paymentType,
    amountInput: draft.amountSource === "unknown" && !draft.amount ? "" : String(draft.amount),
    currency: draft.currency,
    billingStartAt: draft.billingStartAt || "",
    billingEndAt: draft.billingEndAt || "",
    period: draft.paymentType === "recurring" ? draft.period || "1m" : null,
    customPeriodDaysInput: draft.customPeriodDays ? String(draft.customPeriodDays) : "30",
    vendorName: draft.vendorName,
    vendorUrl: draft.vendorUrl,
    accountName: draft.accountName,
    notes: draft.notes,
    customFields: draft.customFields,
    shiftDates: draft.shiftDates,
    shiftPaymentPeriod: draft.shiftPaymentPeriod,
    hint: draft.confidence,
  };
}

function CellError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-[11px] leading-tight text-red-300">{message}</p> : null;
}

function CustomFieldInput({ field, value, onChange, error, locale }: {
  field: CategoryField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  locale: Locale;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {field.type === "checkbox" ? (
        <span className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-sm">
          <Checkbox checked={value === true} onCheckedChange={(next) => onChange(next === true)} />
          {tx(locale, "Enabled", "Включено")}
        </span>
      ) : field.type === "select" ? (
        <NativeSelect value={String(value ?? "")} onChange={onChange} ariaLabel={label} invalid={Boolean(error)}>
          <option value="">{tx(locale, "Select…", "Выберите…")}</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </NativeSelect>
      ) : (
        <Input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className={cn("h-9", error && "border-red-400/70")}
        />
      )}
      <CellError message={error} />
    </label>
  );
}

export function BulkImportPanel({
  categories,
  entries,
  workspaceId,
  readOnly,
  aiAvailable,
  aiLockedReason,
  model,
  defaultCategoryId = null,
  locale = "en",
}: {
  categories: Category[];
  entries: ImportTargetEntry[];
  workspaceId: number;
  readOnly: boolean;
  aiAvailable: boolean;
  aiLockedReason?: string;
  model: string;
  defaultCategoryId?: number | null;
  locale?: Locale;
}) {
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<RowFilter>("all");
  const [questions, setQuestions] = useState<AiQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [parseNote, setParseNote] = useState("");
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState<EntryBatchRowError[]>([]);
  const [applied, setApplied] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingLabel, setPendingLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualCounter = useRef(1);

  const existingSignatures = useMemo(() => new Map(entries.map((entry) => [entrySignature(entry), entry])), [entries]);
  const clientErrors = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.rowKey, validateImportRow(row, categories, CURRENCY_CODES, locale === "ru")])) as Record<string, ImportRowErrors>,
    [categories, locale, rows],
  );
  const serverErrorMap = useMemo(() => {
    const map: Record<string, ImportRowErrors> = {};
    serverErrors.forEach((rowError) => {
      map[rowError.rowKey] = { ...(map[rowError.rowKey] || {}), [rowError.field]: rowError.message };
    });
    return map;
  }, [serverErrors]);

  function errorsFor(rowKey: string): ImportRowErrors {
    return { ...(clientErrors[rowKey] || {}), ...(serverErrorMap[rowKey] || {}) };
  }

  function statusFor(row: ImportRow): RowStatus {
    if (Object.keys(errorsFor(row.rowKey)).length) return "error";
    if (row.action === "create" && existingSignatures.has(entrySignature(row))) return "duplicate";
    return "ready";
  }

  const statuses = Object.fromEntries(rows.map((row) => [row.rowKey, statusFor(row)])) as Record<string, RowStatus>;
  const attentionCount = rows.filter((row) => statuses[row.rowKey] !== "ready").length;
  const visibleRows = filter === "attention" ? rows.filter((row) => statuses[row.rowKey] !== "ready") : rows;
  const selectedRows = rows.filter((row) => selected.has(row.rowKey));
  const selectedValid = selectedRows.filter((row) => statuses[row.rowKey] !== "error");
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.rowKey));

  function loadRows(nextRows: ImportRow[], note: string) {
    setRows(nextRows);
    // Preselect rows that are ready; duplicates and broken rows wait for a decision.
    setSelected(new Set(nextRows.filter((row) => !Object.keys(validateImportRow(row, categories, CURRENCY_CODES)).length && !(row.action === "create" && existingSignatures.has(entrySignature(row)))).map((row) => row.rowKey)));
    setExpanded(new Set());
    setServerErrors([]);
    setFilter("all");
    setParseNote(note);
    setApplied(0);
  }

  function runAi(nextAnswers: Record<string, string>) {
    setError("");
    setPendingLabel(tx(locale, "AI is reading your data…", "AI разбирает данные…"));
    startTransition(async () => {
      try {
        const result = await analyzeAiImportAction(input, nextAnswers, workspaceId);
        setQuestions(result.questions);
        if (result.items.length || !result.questions.length) {
          loadRows(result.items.map(rowFromAiDraft), result.summary || tx(locale, `AI found ${result.items.length} rows.`, `AI нашёл строк: ${result.items.length}.`));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : tx(locale, "AI parsing failed.", "Ошибка AI-разбора."));
      } finally {
        setPendingLabel("");
      }
    });
  }

  function parse(forceAi = false) {
    setError("");
    setQuestions([]);
    setAnswers({});
    if (!forceAi) {
      const tabular = parseTabularInput(input, categories, defaultCategoryId);
      if (tabular) {
        const unmapped = tabular.unmappedColumns.length
          ? tx(locale, ` Unrecognised columns were kept in notes: ${tabular.unmappedColumns.join(", ")}.`, ` Нераспознанные колонки сохранены в заметках: ${tabular.unmappedColumns.join(", ")}.`)
          : "";
        loadRows(tabular.rows, tx(locale, `Read ${tabular.rows.length} rows from ${tabular.format.toUpperCase()} without AI.${unmapped}`, `Прочитано строк из ${tabular.format.toUpperCase()} без AI: ${tabular.rows.length}.${unmapped}`));
        return;
      }
    }
    if (!aiAvailable) {
      setError(aiLockedReason || tx(
        locale,
        "Couldn't find a header row. Add one (for example: name, amount, currency, period, expiry, vendor) or paste JSON.",
        "Не найдена строка заголовков. Добавьте её (например: name, amount, currency, period, expiry, vendor) или вставьте JSON.",
      ));
      return;
    }
    runAi({});
  }

  async function readFile(file: File | null | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError(tx(locale, "File is larger than 2 MB. Split it into smaller files.", "Файл больше 2 МБ. Разделите его."));
      return;
    }
    setInput(await file.text());
    setFileName(file.name);
    setError("");
  }

  function updateRow(rowKey: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)));
    setServerErrors((current) => current.filter((rowError) => rowError.rowKey !== rowKey));
  }

  function updateSelected(patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => (selected.has(row.rowKey) ? { ...row, ...patch } : row)));
  }

  function removeRows(keys: Set<string>) {
    setRows((current) => current.filter((row) => !keys.has(row.rowKey)));
    setSelected((current) => new Set([...current].filter((key) => !keys.has(key))));
  }

  function addManualRow() {
    const row = blankImportRow(`manual-${manualCounter.current++}`, "csv", defaultCategoryId);
    setRows((current) => [row, ...current]);
    setExpanded((current) => new Set(current).add(row.rowKey));
    setFilter("all");
  }

  function toggle(set: Set<string>, key: string, on: boolean) {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  }

  function applySelected() {
    if (!selectedValid.length || readOnly) return;
    setError("");
    setPendingLabel(tx(locale, "Importing…", "Импорт…"));
    startTransition(async () => {
      try {
        const result = await applyImportRowsAction({ workspaceId, rows: selectedValid.map(importRowPayload) });
        if (!result.success) {
          setServerErrors(result.rowErrors);
          setError(result.message || tx(locale, "Some rows were rejected. Fix the highlighted rows and try again.", "Некоторые строки отклонены. Исправьте их и повторите."));
          setFilter("attention");
          return;
        }
        const done = new Set(selectedValid.map((row) => row.rowKey));
        removeRows(done);
        setApplied(result.applied || done.size);
        setParseNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : tx(locale, "Import failed.", "Ошибка импорта."));
      } finally {
        setPendingLabel("");
      }
    });
  }

  const statusBadge = (status: RowStatus) =>
    status === "error" ? (
      <Badge variant="destructive" className="gap-1 px-2 py-0.5"><AlertTriangle className="h-3 w-3" />{tx(locale, "Fix", "Исправить")}</Badge>
    ) : status === "duplicate" ? (
      <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-amber-200"><CopyCheck className="h-3 w-3" />{tx(locale, "Exists?", "Дубль?")}</Badge>
    ) : (
      <Badge variant="success" className="gap-1 px-2 py-0.5"><CheckCircle2 className="h-3 w-3" />{tx(locale, "Ready", "Готово")}</Badge>
    );

  function renderDetails(row: ImportRow) {
    const errors = errorsFor(row.rowKey);
    const category = categories.find((candidate) => candidate.id === row.categoryId);
    const duplicateOf = row.action === "create" ? existingSignatures.get(entrySignature(row)) : undefined;
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {duplicateOf ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100 md:col-span-2 xl:col-span-4">
            {tx(locale, `Looks like the existing entry “${duplicateOf.name}”.`, `Похоже на запись «${duplicateOf.name}».`)}
            <Button type="button" size="sm" variant="secondary" onClick={() => updateRow(row.rowKey, { action: "edit", targetItemId: duplicateOf.id })}>
              {tx(locale, "Update it instead", "Обновить её")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected((current) => toggle(current, row.rowKey, true))}>
              {tx(locale, "Import as new", "Импортировать как новую")}
            </Button>
          </div>
        ) : null}
        {row.action !== "create" ? (
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{row.action === "pay" ? tx(locale, "Record payment for", "Оплата для") : tx(locale, "Update entry", "Обновить запись")}</span>
            <NativeSelect value={String(row.targetItemId || "")} onChange={(value) => updateRow(row.rowKey, { targetItemId: Number(value) || null })} ariaLabel={tx(locale, "Existing entry", "Существующая запись")} invalid={Boolean(errors.id)}>
              <option value="">{tx(locale, "Choose an entry…", "Выберите запись…")}</option>
              {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.accountName ? ` · ${entry.accountName}` : ""}</option>)}
            </NativeSelect>
            <CellError message={errors.id} />
          </label>
        ) : null}
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">URL</span>
          <Input value={row.vendorUrl} onChange={(event) => updateRow(row.rowKey, { vendorUrl: event.target.value })} placeholder="https://…" className={cn("h-9", errors.vendorUrl && "border-red-400/70")} />
          <CellError message={errors.vendorUrl} />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">{tx(locale, "Notes", "Заметки")}</span>
          <Textarea value={row.notes} onChange={(event) => updateRow(row.rowKey, { notes: event.target.value })} className="min-h-9" rows={2} />
        </label>
        {row.action === "pay" ? (
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground md:col-span-2">
            <label className="inline-flex items-center gap-2"><Checkbox checked={row.shiftDates} onCheckedChange={(next) => updateRow(row.rowKey, { shiftDates: next === true })} />{tx(locale, "Shift entry dates", "Сдвинуть даты записи")}</label>
            <label className="inline-flex items-center gap-2"><Checkbox checked={row.shiftPaymentPeriod} onCheckedChange={(next) => updateRow(row.rowKey, { shiftPaymentPeriod: next === true })} />{tx(locale, "Change billing period", "Изменить период")}</label>
          </div>
        ) : null}
        {row.action !== "pay" ? category?.fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            field={field}
            value={row.customFields[field.id]}
            onChange={(value) => updateRow(row.rowKey, { customFields: { ...row.customFields, [field.id]: value } })}
            error={errors[`customFields.${field.id}`]}
            locale={locale}
          />
        )) : null}
        {row.hint ? <p className="text-xs text-subtle-foreground md:col-span-2 xl:col-span-4"><Sparkles className="mr-1 inline h-3 w-3" />{row.hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Surface
        className={cn("relative overflow-hidden p-5 transition-colors", dragging && "border-violet-400/60 bg-violet-500/[0.06]")}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files?.[0]); }}
      >
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <h2 className="text-base font-semibold text-foreground">{tx(locale, "Paste or drop your data", "Вставьте или перетащите данные")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {tx(
                locale,
                "CSV, TSV and JSON with a header row are read instantly, no AI involved. Messy text, lists and invoices go through AI. Nothing is saved until you confirm in the grid below.",
                "CSV, TSV и JSON с заголовками читаются сразу, без AI. Неструктурированный текст, списки и счета разбирает AI. Ничего не сохраняется до подтверждения ниже.",
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />{tx(locale, "Upload file", "Загрузить файл")}
            </Button>
          </div>
        </div>
        <div className="relative">
          <Textarea
            value={input}
            onChange={(event) => { setInput(event.target.value); setFileName(""); }}
            placeholder={tx(
              locale,
              "name,amount,currency,period,expiry,vendor\nexample.com,12,USD,1y,2027-03-01,Namecheap\n\n…or paste anything: “vps-01 at Hetzner, 4.50 EUR monthly, renews on the 5th”",
              "name,amount,currency,period,expiry,vendor\nexample.com,12,USD,1y,2027-03-01,Namecheap\n\n…или любой текст: «vps-01 в Hetzner, 4.50 EUR в месяц, продление 5-го числа»",
            )}
            className="min-h-48 font-mono text-[13px]"
            spellCheck={false}
          />
          {!input ? (
            <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-1.5 text-xs text-subtle-foreground sm:flex">
              <Upload className="h-3.5 w-3.5" />{tx(locale, "Drop .csv / .json / .txt here", "Перетащите .csv / .json / .txt")}
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" disabled={pending || !input.trim()} onClick={() => parse(false)}>
            <Table2 className="h-4 w-4" />{tx(locale, "Parse into grid", "Разобрать в таблицу")}
          </Button>
          {aiAvailable ? (
            <Button type="button" variant="secondary" disabled={pending || !input.trim()} onClick={() => parse(true)} title={tx(locale, `Model: ${model}`, `Модель: ${model}`)}>
              <Wand2 className="h-4 w-4" />{tx(locale, "Parse with AI", "Разобрать с AI")}
            </Button>
          ) : null}
          {input ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setInput(""); setFileName(""); }}>
              <X className="h-4 w-4" />{tx(locale, "Clear", "Очистить")}
            </Button>
          ) : null}
          {fileName ? <Badge variant="secondary">{fileName}</Badge> : null}
          {pending && pendingLabel ? <span className="text-sm text-muted-foreground">{pendingLabel}</span> : null}
          {!aiAvailable && aiLockedReason ? <span className="text-xs text-subtle-foreground">{aiLockedReason}</span> : null}
        </div>
      </Surface>

      {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
      {applied ? (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          {tx(locale, `${applied} row${applied === 1 ? "" : "s"} imported.`, `Импортировано строк: ${applied}.`)}
          <Link href={`/app/items?workspace=${workspaceId}`} className="underline underline-offset-2">{tx(locale, "View entries", "Открыть записи")}</Link>
        </p>
      ) : null}

      {questions.length ? (
        <Surface className="space-y-3 p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">{tx(locale, "AI needs a few details", "AI нужны уточнения")}</h2>
            <p className="text-sm text-muted-foreground">{tx(locale, "Answer what you can, then re-run. You can also skip this and fix rows in the grid.", "Ответьте и запустите снова. Можно пропустить и поправить строки в таблице.")}</p>
          </div>
          {questions.map((question) => (
            <label key={question.id} className="block">
              <span className="text-sm text-foreground">{question.question}</span>
              {question.suggestions.length ? (
                <span className="mt-2 flex flex-wrap gap-2">
                  {question.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: suggestion }))}
                      className={cn("rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-violet-300/40 hover:text-foreground", answers[question.id] === suggestion && "border-violet-300/50 text-foreground")}
                    >
                      {suggestion}
                    </button>
                  ))}
                </span>
              ) : null}
              <Input value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={question.itemName || tx(locale, "Answer", "Ответ")} className="mt-2 h-9" />
            </label>
          ))}
          <Button type="button" disabled={pending} onClick={() => runAi(answers)}>
            <Sparkles className="h-4 w-4" />{tx(locale, "Continue with answers", "Продолжить с ответами")}
          </Button>
        </Surface>
      ) : null}

      {rows.length ? (
        <Surface className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">{tx(locale, "Review before importing", "Проверьте перед импортом")}</h2>
              {parseNote ? <p className="mt-0.5 text-sm text-muted-foreground">{parseNote}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border bg-surface-muted p-0.5 text-xs">
                {(["all", "attention"] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-sm px-2.5 py-1", filter === value ? "bg-surface-raised text-foreground" : "text-muted-foreground")}>
                    {value === "all" ? tx(locale, `All ${rows.length}`, `Все ${rows.length}`) : tx(locale, `Needs attention ${attentionCount}`, `Требуют внимания ${attentionCount}`)}
                  </button>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addManualRow}><Plus className="h-4 w-4" />{tx(locale, "Add row", "Строка")}</Button>
            </div>
          </div>

          {selected.size ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-muted px-4 py-2 text-sm">
              <span className="text-muted-foreground">{tx(locale, `${selected.size} selected — set for all:`, `Выбрано ${selected.size} — для всех:`)}</span>
              <NativeSelect value="" onChange={(value) => value && updateSelected({ categoryId: value === "none" ? null : Number(value) })} ariaLabel={tx(locale, "Category for selected", "Категория для выбранных")} className="h-8 w-44">
                <option value="">{tx(locale, "Category…", "Категория…")}</option>
                <option value="none">{tx(locale, "Uncategorized", "Без категории")}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </NativeSelect>
              <NativeSelect value="" onChange={(value) => value && updateSelected({ currency: value })} ariaLabel={tx(locale, "Currency for selected", "Валюта для выбранных")} className="h-8 w-28">
                <option value="">{tx(locale, "Currency…", "Валюта…")}</option>
                {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
              </NativeSelect>
              <Input placeholder={tx(locale, "Vendor…", "Поставщик…")} className="h-8 w-40" onKeyDown={(event) => { if (event.key === "Enter") { updateSelected({ vendorName: event.currentTarget.value }); event.currentTarget.value = ""; } }} />
              <Button type="button" variant="ghost" size="sm" className="text-red-300" onClick={() => removeRows(new Set(selected))}><Trash2 className="h-4 w-4" />{tx(locale, "Remove", "Убрать")}</Button>
            </div>
          ) : null}

          <div className="max-h-[calc(100vh-320px)] min-h-64 overflow-auto">
            <table className="w-full min-w-[1280px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(next) => setSelected((current) => {
                        const nextSet = new Set(current);
                        visibleRows.forEach((row) => (next === true ? nextSet.add(row.rowKey) : nextSet.delete(row.rowKey)));
                        return nextSet;
                      })}
                      aria-label={tx(locale, "Select all", "Выбрать все")}
                    />
                  </th>
                  <th className="w-24 px-2 py-2.5">{tx(locale, "Status", "Статус")}</th>
                  <th className="w-28 px-2 py-2.5">{tx(locale, "Action", "Действие")}</th>
                  <th className="min-w-52 px-2 py-2.5">{tx(locale, "Name", "Название")}</th>
                  <th className="min-w-40 px-2 py-2.5">{tx(locale, "Category", "Категория")}</th>
                  <th className="w-28 px-2 py-2.5">{tx(locale, "Amount", "Сумма")}</th>
                  <th className="w-24 px-2 py-2.5">{tx(locale, "Currency", "Валюта")}</th>
                  <th className="w-36 px-2 py-2.5">{tx(locale, "Billing", "Оплата")}</th>
                  <th className="w-36 px-2 py-2.5">{tx(locale, "Start", "Начало")}</th>
                  <th className="w-36 px-2 py-2.5">{tx(locale, "End / expiry", "Окончание")}</th>
                  <th className="min-w-36 px-2 py-2.5">{tx(locale, "Vendor", "Поставщик")}</th>
                  <th className="min-w-32 px-2 py-2.5">{tx(locale, "Account", "Аккаунт")}</th>
                  <th className="w-20 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => {
                  const errors = errorsFor(row.rowKey);
                  const status = statuses[row.rowKey];
                  const isExpanded = expanded.has(row.rowKey);
                  const billingValue = row.paymentType === "single" ? "single" : row.period || "1m";
                  return [
                    <tr key={row.rowKey} className={cn("align-top hover:bg-surface-raised", status === "error" && "bg-red-500/[0.03]", !selected.has(row.rowKey) && "opacity-70")}>
                      <td className="px-3 py-2"><Checkbox checked={selected.has(row.rowKey)} onCheckedChange={(next) => setSelected((current) => toggle(current, row.rowKey, next === true))} aria-label={tx(locale, "Include row", "Включить строку")} className="mt-2" /></td>
                      <td className="px-2 py-2"><div className="pt-1.5">{statusBadge(status)}</div></td>
                      <td className="px-2 py-2">
                        <NativeSelect value={row.action} onChange={(value) => updateRow(row.rowKey, { action: value as ImportRow["action"] })} ariaLabel={tx(locale, "Action", "Действие")}>
                          <option value="create">{tx(locale, "Create", "Создать")}</option>
                          <option value="edit">{tx(locale, "Update", "Обновить")}</option>
                          <option value="pay">{tx(locale, "Payment", "Оплата")}</option>
                        </NativeSelect>
                      </td>
                      <td className="px-2 py-2">
                        <Input value={row.name} onChange={(event) => updateRow(row.rowKey, { name: event.target.value })} className={cn("h-9", errors.name && "border-red-400/70")} aria-label={tx(locale, "Name", "Название")} />
                        <CellError message={errors.name || (!isExpanded ? errors.id : undefined)} />
                      </td>
                      <td className="px-2 py-2">
                        <NativeSelect value={String(row.categoryId || "")} onChange={(value) => updateRow(row.rowKey, { categoryId: Number(value) || null })} ariaLabel={tx(locale, "Category", "Категория")} invalid={Boolean(errors.categoryId)}>
                          <option value="">{tx(locale, "Uncategorized", "Без категории")}</option>
                          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </NativeSelect>
                        {!isExpanded && Object.keys(errors).some((key) => key.startsWith("customFields.")) ? <CellError message={tx(locale, "Required fields missing — open details", "Не заполнены поля — откройте детали")} /> : null}
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min="0" step="0.01" value={row.amountInput} onChange={(event) => updateRow(row.rowKey, { amountInput: event.target.value })} className={cn("h-9", errors.amount && "border-red-400/70")} aria-label={tx(locale, "Amount", "Сумма")} />
                        <CellError message={errors.amount} />
                      </td>
                      <td className="px-2 py-2">
                        <NativeSelect value={row.currency} onChange={(value) => updateRow(row.rowKey, { currency: value })} ariaLabel={tx(locale, "Currency", "Валюта")} invalid={Boolean(errors.currency)}>
                          {!CURRENCY_CODES.includes(row.currency) ? <option value={row.currency}>{row.currency}</option> : null}
                          {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                        </NativeSelect>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <NativeSelect
                            value={billingValue}
                            onChange={(value) => updateRow(row.rowKey, value === "single" ? { paymentType: "single", period: null } : { paymentType: "recurring", period: value as BillingPeriod })}
                            ariaLabel={tx(locale, "Billing", "Оплата")}
                          >
                            <option value="single">{tx(locale, "One-time", "Разово")}</option>
                            {PERIODS.map((period) => <option key={period} value={period}>{period === "custom" ? tx(locale, "Custom", "Свой") : periodLabel(period)}</option>)}
                          </NativeSelect>
                          {row.period === "custom" && row.paymentType === "recurring" ? (
                            <Input type="number" min="1" value={row.customPeriodDaysInput} onChange={(event) => updateRow(row.rowKey, { customPeriodDaysInput: event.target.value })} className="h-9 w-16" aria-label={tx(locale, "Days", "Дней")} />
                          ) : null}
                        </div>
                        <CellError message={errors.customPeriodDays} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="date" value={row.billingStartAt} onChange={(event) => updateRow(row.rowKey, { billingStartAt: event.target.value })} className={cn("h-9", errors.billingStartAt && "border-red-400/70")} aria-label={tx(locale, "Start", "Начало")} />
                        <CellError message={errors.billingStartAt} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="date" value={row.billingEndAt} onChange={(event) => updateRow(row.rowKey, { billingEndAt: event.target.value })} className={cn("h-9", errors.billingEndAt && "border-red-400/70")} aria-label={tx(locale, "End", "Окончание")} />
                        <CellError message={errors.billingEndAt} />
                      </td>
                      <td className="px-2 py-2"><Input value={row.vendorName} onChange={(event) => updateRow(row.rowKey, { vendorName: event.target.value })} className="h-9" aria-label={tx(locale, "Vendor", "Поставщик")} /></td>
                      <td className="px-2 py-2"><Input value={row.accountName} onChange={(event) => updateRow(row.rowKey, { accountName: event.target.value })} className="h-9" aria-label={tx(locale, "Account", "Аккаунт")} /></td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-0.5 pt-0.5">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((current) => toggle(current, row.rowKey, !isExpanded))} aria-label={isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали")}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-300" onClick={() => removeRows(new Set([row.rowKey]))} aria-label={tx(locale, "Remove row", "Убрать строку")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${row.rowKey}-details`}>
                        <td colSpan={13} className="bg-surface-muted px-5 py-4">{renderDetails(row)}</td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
            {!visibleRows.length ? <p className="py-12 text-center text-sm text-subtle-foreground">{tx(locale, "Nothing needs attention.", "Всё в порядке.")}</p> : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedRows.length !== selectedValid.length
                ? tx(locale, `${selectedRows.length - selectedValid.length} selected row(s) still need fixes and will be skipped.`, `Выбранных строк с ошибками: ${selectedRows.length - selectedValid.length} — они будут пропущены.`)
                : tx(locale, "Rows marked “Exists?” match an entry you already have; open them to update it instead.", "Строки «Дубль?» совпадают с существующими записями; откройте их, чтобы обновить запись.")}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => { setRows([]); setSelected(new Set()); setParseNote(""); }}>{tx(locale, "Discard", "Отменить")}</Button>
              <Button type="button" disabled={pending || readOnly || !selectedValid.length} onClick={applySelected}>
                <CheckCircle2 className="h-4 w-4" />
                {readOnly ? tx(locale, "View only", "Только просмотр") : tx(locale, `Import ${selectedValid.length} row${selectedValid.length === 1 ? "" : "s"}`, `Импортировать: ${selectedValid.length}`)}
              </Button>
            </div>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
