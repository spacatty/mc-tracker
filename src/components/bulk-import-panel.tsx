"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CopyCheck,
  FileText,
  FileUp,
  Loader2,
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
import { pluralRu, type Locale } from "@/lib/i18n";
import type { AiQuestion } from "@/lib/ai/import-schema";
import {
  blankImportRow,
  entrySignature,
  importRowPayload,
  parseTabularInput,
  rowFromAiDraft,
  validateImportRow,
  type ImportRow,
  type ImportRowErrors,
} from "@/lib/import/rows";
import type { BillingPeriod, Category, CategoryField, EntryBatchRowError } from "@/lib/types";
import { cn, periodLabel } from "@/lib/utils";
import { Alert } from "./ui/alert";
import { Badge, badgeVariants } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DatePickerInput } from "./ui/date-picker";
import { Field, Fieldset } from "./ui/field";
import { Input, Textarea } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { RowAction, RowActions } from "./ui/row-actions";
import { SectionCard } from "./ui/section-card";
import { SegmentedControl } from "./ui/segmented";
import {
  SelectionBar,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
  TableToolbar,
} from "./ui/table";
import { Tooltip } from "./ui/tooltip";

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
const COLUMN_COUNT = 13;

/** Grid controls: h-8, 13px text, error border via aria-invalid. */
const cellInputClass = "h-8 rounded-md px-2.5 text-[13px] aria-[invalid=true]:border-red-400/70 aria-[invalid=true]:focus:ring-red-400/30";
/** Body cells align to the top so an error line under one input does not shift its neighbours. */
const cellClass = "align-top";

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

function CellError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <p id={id} className="mt-1 max-w-56 text-[11px] leading-tight text-red-300">
      {message}
    </p>
  ) : null;
}

/** Small numbered tile in front of each step title; turns into a check when the step is done. */
function StepTitle({ step, done, children }: { step: number; done?: boolean; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular-nums",
          done ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.06] text-zinc-300",
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : step}
      </span>
      {children}
    </span>
  );
}

function CustomFieldInput({ field, value, onChange, error, locale, id }: {
  field: CategoryField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  locale: Locale;
  id: string;
}) {
  if (field.type === "checkbox") {
    return (
      <Field error={error} className="self-end">
        <label htmlFor={id} className="flex h-9 cursor-pointer items-center gap-2.5 text-[13px] text-zinc-300">
          <Checkbox id={id} checked={value === true} onCheckedChange={(next) => onChange(next === true)} />
          {field.label}
          {field.required ? <span className="text-red-300/80" aria-hidden="true">*</span> : null}
        </label>
      </Field>
    );
  }
  return (
    <Field label={field.label} required={field.required} htmlFor={id} error={error}>
      {field.type === "select" ? (
        <NativeSelect id={id} value={String(value ?? "")} onChange={onChange} ariaLabel={field.label} invalid={Boolean(error)}>
          <option value="">{tx(locale, "Select…", "Выберите…")}</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(error && "border-red-400/70")}
        />
      )}
    </Field>
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
  // AI never writes notes unless the user opts in.
  const [noNotes, setNoNotes] = useState(true);
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
  const [bulkVendor, setBulkVendor] = useState("");
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
  const visibleSelectedCount = visibleRows.filter((row) => selected.has(row.rowKey)).length;
  const headerChecked = visibleRows.length > 0 && visibleSelectedCount === visibleRows.length ? true : visibleSelectedCount > 0 ? "indeterminate" : false;
  const stage: "source" | "clarify" | "review" = rows.length ? "review" : questions.length ? "clarify" : "source";
  const reviewStep = questions.length ? 3 : 2;

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
        const result = await analyzeAiImportAction(input, nextAnswers, workspaceId, { noNotes });
        setQuestions(result.questions);
        if (result.items.length || !result.questions.length) {
          loadRows(result.items.map(rowFromAiDraft), result.summary || tx(locale, `AI found ${result.items.length} rows.`, `AI нашёл ${result.items.length} ${pluralRu(result.items.length, "строку", "строки", "строк")}.`));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : tx(locale, "AI parsing failed.", "Не удалось разобрать данные с помощью AI."));
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
          ? tx(locale, ` Unrecognised columns were kept in notes: ${tabular.unmappedColumns.join(", ")}.`, ` Нераспознанные столбцы сохранены в заметках: ${tabular.unmappedColumns.join(", ")}.`)
          : "";
        loadRows(tabular.rows, tx(locale, `Read ${tabular.rows.length} rows from ${tabular.format.toUpperCase()} without AI.${unmapped}`, `${pluralRu(tabular.rows.length, "Прочитана", "Прочитано", "Прочитано")} ${tabular.rows.length} ${pluralRu(tabular.rows.length, "строка", "строки", "строк")} из ${tabular.format.toUpperCase()} без AI.${unmapped}`));
        return;
      }
    }
    if (!aiAvailable) {
      setError(aiLockedReason || tx(
        locale,
        "Couldn't find a header row. Add one (for example: name, amount, currency, period, expiry, vendor) or paste JSON.",
        "Не удалось найти строку заголовков. Добавьте её (например: name, amount, currency, period, expiry, vendor) или вставьте JSON.",
      ));
      return;
    }
    runAi({});
  }

  async function readFile(file: File | null | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      setError(tx(locale, "File is larger than 2 MB. Split it into smaller files.", "Файл больше 2 МБ. Разделите его на части."));
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

  function discardRows() {
    setRows([]);
    setSelected(new Set());
    setParseNote("");
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
          setError(result.message || tx(locale, "Some rows were rejected. Fix the highlighted rows and try again.", "Часть строк отклонена. Исправьте выделенные строки и попробуйте снова."));
          setFilter("attention");
          return;
        }
        const done = new Set(selectedValid.map((row) => row.rowKey));
        removeRows(done);
        setApplied(result.applied || done.size);
        setParseNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : tx(locale, "Import failed.", "Не удалось выполнить импорт."));
      } finally {
        setPendingLabel("");
      }
    });
  }

  const statusBadge = (status: RowStatus) =>
    status === "error" ? (
      <Badge tone="danger" icon={<AlertTriangle />}>{tx(locale, "Fix", "Исправить")}</Badge>
    ) : status === "duplicate" ? (
      <Badge tone="warning" icon={<CopyCheck />}>{tx(locale, "Exists?", "Уже есть?")}</Badge>
    ) : (
      <Badge tone="success" icon={<CheckCircle2 />}>{tx(locale, "Ready", "Готово")}</Badge>
    );

  function renderDetails(row: ImportRow) {
    const errors = errorsFor(row.rowKey);
    const category = categories.find((candidate) => candidate.id === row.categoryId);
    const duplicateOf = row.action === "create" ? existingSignatures.get(entrySignature(row)) : undefined;
    const id = (name: string) => `import-${row.rowKey}-${name}`;
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {duplicateOf ? (
          <Alert
            tone="warning"
            className="md:col-span-2 xl:col-span-4"
            title={tx(locale, `Looks like the existing entry “${duplicateOf.name}”`, `Похоже на существующую запись «${duplicateOf.name}»`)}
            action={(
              <>
                <Button type="button" size="xs" variant="secondary" onClick={() => updateRow(row.rowKey, { action: "edit", targetItemId: duplicateOf.id })}>
                  {tx(locale, "Update it instead", "Обновить существующую")}
                </Button>
                <Button type="button" size="xs" variant="ghost" onClick={() => setSelected((current) => toggle(current, row.rowKey, true))}>
                  {tx(locale, "Import as new", "Импортировать как новую")}
                </Button>
              </>
            )}
          />
        ) : null}
        {row.action !== "create" ? (
          <Field
            label={row.action === "pay" ? tx(locale, "Record payment for", "Записать оплату для") : tx(locale, "Update entry", "Обновить запись")}
            htmlFor={id("target")}
            error={errors.id}
            className="md:col-span-2"
          >
            <NativeSelect id={id("target")} value={String(row.targetItemId || "")} onChange={(value) => updateRow(row.rowKey, { targetItemId: Number(value) || null })} ariaLabel={tx(locale, "Existing entry", "Существующая запись")} invalid={Boolean(errors.id)}>
              <option value="">{tx(locale, "Choose an entry…", "Выберите запись…")}</option>
              {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.accountName ? ` · ${entry.accountName}` : ""}</option>)}
            </NativeSelect>
          </Field>
        ) : null}
        <Field label="URL" htmlFor={id("url")} error={errors.vendorUrl} className="md:col-span-2">
          <Input
            id={id("url")}
            value={row.vendorUrl}
            onChange={(event) => updateRow(row.rowKey, { vendorUrl: event.target.value })}
            placeholder="https://…"
            aria-invalid={errors.vendorUrl ? true : undefined}
            className={cn(errors.vendorUrl && "border-red-400/70")}
          />
        </Field>
        <Field label={tx(locale, "Notes", "Заметки")} htmlFor={id("notes")} className="md:col-span-2">
          <Textarea id={id("notes")} value={row.notes} onChange={(event) => updateRow(row.rowKey, { notes: event.target.value })} className="min-h-9" rows={2} />
        </Field>
        {row.action === "pay" ? (
          <Fieldset legend={tx(locale, "After the payment", "После оплаты")} className="md:col-span-2">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-zinc-300">
                <Checkbox checked={row.shiftDates} onCheckedChange={(next) => updateRow(row.rowKey, { shiftDates: next === true })} />
                {tx(locale, "Shift entry dates", "Сдвинуть даты записи")}
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-zinc-300">
                <Checkbox checked={row.shiftPaymentPeriod} onCheckedChange={(next) => updateRow(row.rowKey, { shiftPaymentPeriod: next === true })} />
                {tx(locale, "Change billing period", "Изменить период оплаты")}
              </label>
            </div>
          </Fieldset>
        ) : null}
        {row.action !== "pay" ? category?.fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            id={id(`field-${field.id}`)}
            field={field}
            value={row.customFields[field.id]}
            onChange={(value) => updateRow(row.rowKey, { customFields: { ...row.customFields, [field.id]: value } })}
            error={errors[`customFields.${field.id}`]}
            locale={locale}
          />
        )) : null}
        {row.hint ? (
          <p className="flex items-start gap-1.5 text-[11.5px] leading-[1.125rem] text-zinc-500 md:col-span-2 xl:col-span-4">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-300" aria-hidden="true" />
            {row.hint}
          </p>
        ) : null}
      </div>
    );
  }

  const sourceDone = stage !== "source";

  return (
    <div className="space-y-6">
      {/* Step 1: source */}
      <SectionCard
        title={<StepTitle step={1} done={sourceDone}>{tx(locale, "Paste or drop your data", "Вставьте или перетащите данные")}</StepTitle>}
        description={tx(
          locale,
          "CSV, TSV and JSON with a header row are read instantly, without AI. Messy text, lists and invoices go through AI. Nothing is saved until you confirm in the review step.",
          "CSV, TSV и JSON со строкой заголовков читаются сразу, без AI. Произвольный текст, списки и счета разбирает AI. Ничего не сохранится, пока вы не подтвердите импорт на шаге проверки.",
        )}
        actions={(
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" />{tx(locale, "Upload file", "Загрузить файл")}
            </Button>
          </>
        )}
        bodyClassName="space-y-3"
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files?.[0]); }}
        footer={(
          <>
            <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              {aiAvailable ? (
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-zinc-300">
                  <Checkbox checked={noNotes} onCheckedChange={(next) => setNoNotes(next === true)} />
                  {tx(locale, "Don't add notes", "Без заметок")}
                  <span className="text-[11.5px] text-zinc-500">{tx(locale, "AI leaves the notes field empty", "AI оставит поле заметок пустым")}</span>
                </label>
              ) : null}
              {pending && pendingLabel ? (
                <span className="inline-flex items-center gap-2 text-[13px] text-zinc-400" aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {pendingLabel}
                </span>
              ) : null}
            </div>
            {aiAvailable ? (
              <Tooltip label={tx(locale, `Model: ${model}`, `Модель: ${model}`)}>
                <Button type="button" variant="secondary" size="sm" disabled={pending || !input.trim()} onClick={() => parse(true)} aria-label={tx(locale, "Parse with AI", "Разобрать с помощью AI")}>
                  <Wand2 className="h-3.5 w-3.5" />{tx(locale, "Parse with AI", "Разобрать с помощью AI")}
                </Button>
              </Tooltip>
            ) : null}
            <Button type="button" size="sm" variant={stage === "source" ? "default" : "secondary"} disabled={pending || !input.trim()} onClick={() => parse(false)}>
              <Table2 className="h-3.5 w-3.5" />{tx(locale, "Parse into grid", "Разобрать в таблицу")}
            </Button>
          </>
        )}
      >
        <div
          className={cn(
            "relative rounded-lg transition",
            dragging && "outline-dashed outline-2 outline-offset-2 outline-violet-400/50",
          )}
        >
          <Textarea
            value={input}
            onChange={(event) => { setInput(event.target.value); setFileName(""); }}
            aria-label={tx(locale, "Data to import", "Данные для импорта")}
            placeholder={tx(
              locale,
              "name,amount,currency,period,expiry,vendor\nexample.com,12,USD,1y,2027-03-01,Namecheap\n\n…or paste anything: “vps-01 at Hetzner, 4.50 EUR monthly, renews on the 5th”",
              "name,amount,currency,period,expiry,vendor\nexample.com,12,USD,1y,2027-03-01,Namecheap\n\n…или любой текст: «vps-01 в Hetzner, 4.50 EUR в месяц, продление 5-го числа»",
            )}
            className={cn("min-h-48 bg-white/[0.02] font-mono text-[12.5px] leading-5", dragging && "border-violet-400/40 bg-violet-500/[0.04]")}
            spellCheck={false}
          />
          {!input ? (
            <div className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-1.5 text-[11.5px] text-zinc-500 sm:flex">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />{tx(locale, "Drop .csv / .json / .txt here", "Перетащите сюда .csv / .json / .txt")}
            </div>
          ) : null}
        </div>
        {fileName || input ? (
          <div className="flex flex-wrap items-center gap-3">
            {fileName ? <Badge icon={<FileText />} className="text-zinc-400">{fileName}</Badge> : null}
            {input ? (
              <Button type="button" variant="ghost" size="xs" onClick={() => { setInput(""); setFileName(""); }}>
                <X className="h-3.5 w-3.5" />{tx(locale, "Clear", "Очистить")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {!aiAvailable && aiLockedReason ? <Alert tone="info">{aiLockedReason}</Alert> : null}
      </SectionCard>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {applied ? (
        <Alert
          tone="success"
          title={tx(locale, `${applied} row${applied === 1 ? "" : "s"} imported`, `${pluralRu(applied, "Импортирована", "Импортировано", "Импортировано")} ${applied} ${pluralRu(applied, "строка", "строки", "строк")}`)}
          action={(
            <Button asChild size="xs" variant="ghost" className="text-emerald-100 hover:text-white">
              <Link href={`/app/items?workspace=${workspaceId}`}>
                {tx(locale, "View entries", "Открыть записи")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        />
      ) : null}

      {/* Step 2 (AI only): clarifying questions */}
      {questions.length ? (
        <SectionCard
          title={<StepTitle step={2} done={stage === "review"}>{tx(locale, "AI needs a few details", "AI нужно кое-что уточнить")}</StepTitle>}
          description={tx(locale, "Answer what you can, then continue. You can also skip this and fix rows in the review step.", "Ответьте на то, что знаете, и продолжите. Этот шаг можно пропустить и поправить строки при проверке.")}
          bodyClassName="grid gap-5"
          footer={(
            <Button type="button" size="sm" variant={stage === "clarify" ? "default" : "secondary"} disabled={pending} onClick={() => runAi(answers)}>
              <Sparkles className="h-3.5 w-3.5" />{tx(locale, "Continue with answers", "Продолжить с ответами")}
            </Button>
          )}
        >
          {questions.map((question) => {
            const fieldId = `import-question-${question.id}`;
            return (
              <Field key={question.id} label={<span className="text-[13px] font-normal text-zinc-200">{question.question}</span>} htmlFor={fieldId}>
                {question.suggestions.length ? (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx(locale, "Suggestions", "Варианты")}>
                    {question.suggestions.map((suggestion) => {
                      const chosen = answers[question.id] === suggestion;
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: suggestion }))}
                          className={cn(
                            badgeVariants({ variant: "outline", tone: chosen ? "accent" : "default" }),
                            "h-6 cursor-pointer text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
                            chosen && "text-violet-200 ring-violet-400/40",
                          )}
                        >
                          {chosen ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                          {suggestion}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <Input
                  id={fieldId}
                  value={answers[question.id] || ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  placeholder={question.itemName || tx(locale, "Answer", "Ответ")}
                />
              </Field>
            );
          })}
        </SectionCard>
      ) : null}

      {/* Final step: review grid */}
      {rows.length ? (
        <SectionCard
          flush
          title={<StepTitle step={reviewStep}>{tx(locale, "Review before importing", "Проверьте перед импортом")}</StepTitle>}
          description={parseNote || undefined}
          footer={(
            <>
              <p className="mr-auto min-w-0 text-xs leading-5 text-zinc-500">
                {selectedRows.length !== selectedValid.length
                  ? tx(locale, `${selectedRows.length - selectedValid.length} selected row(s) still need fixes and will be skipped.`, `${selectedRows.length - selectedValid.length} ${pluralRu(selectedRows.length - selectedValid.length, "выбранная строка требует исправлений и будет пропущена", "выбранные строки требуют исправлений и будут пропущены", "выбранных строк требуют исправлений и будут пропущены")}.`)
                  : tx(locale, "Rows marked “Exists?” match an entry you already have; open their details to update it instead.", "Строки с отметкой «Уже есть?» совпадают с вашими записями — откройте детали, чтобы обновить существующую запись.")}
              </p>
              <Button type="button" size="sm" variant="ghost" onClick={discardRows}>{tx(locale, "Discard", "Сбросить")}</Button>
              <Button type="button" size="sm" disabled={pending || readOnly || !selectedValid.length} onClick={applySelected}>
                {pending && pendingLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {readOnly ? tx(locale, "View only", "Только просмотр") : tx(locale, `Import ${selectedValid.length} row${selectedValid.length === 1 ? "" : "s"}`, `Импортировать ${selectedValid.length} ${pluralRu(selectedValid.length, "строку", "строки", "строк")}`)}
              </Button>
            </>
          )}
        >
          <TableToolbar
            end={(
              <Button type="button" variant="ghost" size="sm" onClick={addManualRow}>
                <Plus className="h-3.5 w-3.5" />{tx(locale, "Add row", "Добавить строку")}
              </Button>
            )}
          >
            <SegmentedControl<RowFilter>
              ariaLabel={tx(locale, "Show rows", "Показать строки")}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: tx(locale, "All", "Все"), count: rows.length },
                { value: "attention", label: tx(locale, "Needs attention", "Требуют внимания"), count: attentionCount },
              ]}
            />
          </TableToolbar>

          <Table bare stickyHeader density="compact" minWidth={1440} containerClassName="max-h-[calc(100vh-320px)]">
            <TableHeader>
              <TableRow>
                <TableSelectHead
                  checked={headerChecked}
                  onCheckedChange={(next) => setSelected((current) => {
                    const nextSet = new Set(current);
                    visibleRows.forEach((row) => (next === true ? nextSet.add(row.rowKey) : nextSet.delete(row.rowKey)));
                    return nextSet;
                  })}
                  label={tx(locale, "Select all", "Выбрать все")}
                />
                <TableHead className="min-w-24">{tx(locale, "Status", "Статус")}</TableHead>
                <TableHead className="min-w-32">{tx(locale, "Action", "Действие")}</TableHead>
                <TableHead className="min-w-52">{tx(locale, "Name", "Название")}</TableHead>
                <TableHead className="min-w-40">{tx(locale, "Category", "Категория")}</TableHead>
                <TableHead className="min-w-28">{tx(locale, "Amount", "Сумма")}</TableHead>
                <TableHead className="min-w-24">{tx(locale, "Currency", "Валюта")}</TableHead>
                <TableHead className="min-w-36">{tx(locale, "Billing", "Период")}</TableHead>
                <TableHead className="min-w-40">{tx(locale, "Start", "Начало")}</TableHead>
                <TableHead className="min-w-40">{tx(locale, "End / expiry", "Окончание")}</TableHead>
                <TableHead className="min-w-36">{tx(locale, "Vendor", "Поставщик")}</TableHead>
                <TableHead className="min-w-32">{tx(locale, "Account", "Аккаунт")}</TableHead>
                <TableHead align="right" className="w-[1%]"><span className="sr-only">{tx(locale, "Actions", "Действия")}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const errors = errorsFor(row.rowKey);
                const status = statuses[row.rowKey];
                const isExpanded = expanded.has(row.rowKey);
                const isSelected = selected.has(row.rowKey);
                const billingValue = row.paymentType === "single" ? "single" : row.period || "1m";
                const rowName = row.name.trim();
                const hiddenFieldErrors = !isExpanded && Object.keys(errors).some((key) => key.startsWith("customFields."));
                return [
                  <TableRow
                    key={row.rowKey}
                    className={cn(
                      !isSelected && "[&>td:not(:first-child)]:opacity-60",
                      status === "error" && "[&>td:first-child]:shadow-[inset_2px_0_0_rgb(248_113_113/0.6)]",
                    )}
                  >
                    <TableSelectCell
                      checked={isSelected}
                      onCheckedChange={(next) => setSelected((current) => toggle(current, row.rowKey, next === true))}
                      label={rowName ? tx(locale, `Include “${rowName}”`, `Включить «${rowName}»`) : tx(locale, "Include row", "Включить строку")}
                      cellClassName="align-top pt-3.5"
                    />
                    <TableCell className={cn(cellClass, "pt-3")}>{statusBadge(status)}</TableCell>
                    <TableCell className={cellClass}>
                      <NativeSelect size="sm" value={row.action} onChange={(value) => updateRow(row.rowKey, { action: value as ImportRow["action"] })} ariaLabel={tx(locale, "Action", "Действие")}>
                        <option value="create">{tx(locale, "Create", "Создать")}</option>
                        <option value="edit">{tx(locale, "Update", "Обновить")}</option>
                        <option value="pay">{tx(locale, "Payment", "Оплата")}</option>
                      </NativeSelect>
                    </TableCell>
                    <TableCell className={cellClass}>
                      <Input value={row.name} onChange={(event) => updateRow(row.rowKey, { name: event.target.value })} aria-invalid={errors.name ? true : undefined} className={cn(cellInputClass, "font-medium text-zinc-100")} aria-label={tx(locale, "Name", "Название")} />
                      <CellError message={errors.name || (!isExpanded ? errors.id : undefined)} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <NativeSelect size="sm" value={String(row.categoryId || "")} onChange={(value) => updateRow(row.rowKey, { categoryId: Number(value) || null })} ariaLabel={tx(locale, "Category", "Категория")} invalid={Boolean(errors.categoryId)}>
                        <option value="">{tx(locale, "Uncategorized", "Без категории")}</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </NativeSelect>
                      <CellError message={errors.categoryId || (hiddenFieldErrors ? tx(locale, "Required fields missing — open details", "Не заполнены обязательные поля — откройте детали") : undefined)} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <Input type="number" min="0" step="0.01" value={row.amountInput} onChange={(event) => updateRow(row.rowKey, { amountInput: event.target.value })} aria-invalid={errors.amount ? true : undefined} className={cn(cellInputClass, "tabular-nums")} aria-label={tx(locale, "Amount", "Сумма")} />
                      <CellError message={errors.amount} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <NativeSelect size="sm" value={row.currency} onChange={(value) => updateRow(row.rowKey, { currency: value })} ariaLabel={tx(locale, "Currency", "Валюта")} invalid={Boolean(errors.currency)}>
                        {!CURRENCY_CODES.includes(row.currency) ? <option value={row.currency}>{row.currency}</option> : null}
                        {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                      </NativeSelect>
                      <CellError message={errors.currency} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <div className="flex gap-1">
                        <NativeSelect
                          size="sm"
                          value={billingValue}
                          onChange={(value) => updateRow(row.rowKey, value === "single" ? { paymentType: "single", period: null } : { paymentType: "recurring", period: value as BillingPeriod })}
                          ariaLabel={tx(locale, "Billing", "Период оплаты")}
                        >
                          <option value="single">{tx(locale, "One-time", "Разовый")}</option>
                          {PERIODS.map((period) => <option key={period} value={period}>{period === "custom" ? tx(locale, "Custom", "Свой") : periodLabel(period)}</option>)}
                        </NativeSelect>
                        {row.period === "custom" && row.paymentType === "recurring" ? (
                          <Input type="number" min="1" value={row.customPeriodDaysInput} onChange={(event) => updateRow(row.rowKey, { customPeriodDaysInput: event.target.value })} aria-invalid={errors.customPeriodDays ? true : undefined} className={cn(cellInputClass, "w-16 shrink-0 px-2 tabular-nums")} aria-label={tx(locale, "Days", "Количество дней")} />
                        ) : null}
                      </div>
                      <CellError message={errors.customPeriodDays} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <DatePickerInput name={`import_${row.rowKey}_start`} size="sm" value={row.billingStartAt} onChange={(value) => updateRow(row.rowKey, { billingStartAt: value })} invalid={Boolean(errors.billingStartAt)} locale={locale} ariaLabel={tx(locale, "Start", "Начало")} triggerClassName="rounded-md px-2.5" />
                      <CellError message={errors.billingStartAt} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <DatePickerInput name={`import_${row.rowKey}_end`} size="sm" value={row.billingEndAt} onChange={(value) => updateRow(row.rowKey, { billingEndAt: value })} invalid={Boolean(errors.billingEndAt)} locale={locale} ariaLabel={tx(locale, "End", "Окончание")} triggerClassName="rounded-md px-2.5" />
                      <CellError message={errors.billingEndAt} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <Input value={row.vendorName} onChange={(event) => updateRow(row.rowKey, { vendorName: event.target.value })} className={cellInputClass} aria-label={tx(locale, "Vendor", "Поставщик")} />
                    </TableCell>
                    <TableCell className={cellClass}>
                      <Input value={row.accountName} onChange={(event) => updateRow(row.rowKey, { accountName: event.target.value })} className={cellInputClass} aria-label={tx(locale, "Account", "Аккаунт")} />
                    </TableCell>
                    <TableCell align="right" className={cn(cellClass, "w-[1%] whitespace-nowrap pt-2")}>
                      <RowActions>
                        <RowAction
                          label={isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали")}
                          icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
                          aria-expanded={isExpanded}
                          className={cn(isExpanded && "bg-white/[0.06] text-zinc-100")}
                          onClick={() => setExpanded((current) => toggle(current, row.rowKey, !isExpanded))}
                        />
                        <RowAction
                          label={rowName ? tx(locale, `Remove “${rowName}”`, `Убрать «${rowName}»`) : tx(locale, "Remove row", "Убрать строку")}
                          icon={<Trash2 />}
                          tone="danger"
                          onClick={() => removeRows(new Set([row.rowKey]))}
                        />
                      </RowActions>
                    </TableCell>
                  </TableRow>,
                  isExpanded ? (
                    // data-empty keeps the row-hover wash off the details panel.
                    <tr key={`${row.rowKey}-details`} data-empty="">
                      <td colSpan={COLUMN_COUNT} className="border-t border-white/[0.04] bg-white/[0.015] px-5 py-4">
                        {renderDetails(row)}
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
              {!visibleRows.length ? (
                <TableEmpty
                  colSpan={COLUMN_COUNT}
                  icon={<CheckCircle2 />}
                  title={tx(locale, "Nothing needs attention", "Всё в порядке")}
                  description={tx(locale, "Every row is ready to import.", "Все строки готовы к импорту.")}
                  action={<Button type="button" size="sm" variant="ghost" onClick={() => setFilter("all")}>{tx(locale, "Show all rows", "Показать все строки")}</Button>}
                />
              ) : null}
            </TableBody>
          </Table>

          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} locale={locale}>
            <span className="hidden text-xs text-zinc-500 lg:inline">{tx(locale, "Set for all:", "Для выбранных:")}</span>
            <NativeSelect size="sm" value="" onChange={(value) => value && updateSelected({ categoryId: value === "none" ? null : Number(value) })} ariaLabel={tx(locale, "Category for selected", "Категория для выбранных")} className="w-44">
              <option value="">{tx(locale, "Category…", "Категория…")}</option>
              <option value="none">{tx(locale, "Uncategorized", "Без категории")}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </NativeSelect>
            <NativeSelect size="sm" value="" onChange={(value) => value && updateSelected({ currency: value })} ariaLabel={tx(locale, "Currency for selected", "Валюта для выбранных")} className="w-28">
              <option value="">{tx(locale, "Currency…", "Валюта…")}</option>
              {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
            </NativeSelect>
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (!bulkVendor.trim()) return;
                updateSelected({ vendorName: bulkVendor.trim() });
                setBulkVendor("");
              }}
            >
              <Input
                value={bulkVendor}
                onChange={(event) => setBulkVendor(event.target.value)}
                placeholder={tx(locale, "Vendor…", "Поставщик…")}
                aria-label={tx(locale, "Vendor for selected", "Поставщик для выбранных")}
                className={cn(cellInputClass, "w-40")}
              />
              {bulkVendor.trim() ? (
                <Button type="submit" size="sm" variant="secondary">{tx(locale, "Set", "Применить")}</Button>
              ) : null}
            </form>
            <Button type="button" variant="ghost" size="sm" className="text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => removeRows(new Set(selected))}>
              <Trash2 className="h-3.5 w-3.5" />{tx(locale, "Remove", "Убрать")}
            </Button>
          </SelectionBar>
        </SectionCard>
      ) : null}
    </div>
  );
}
