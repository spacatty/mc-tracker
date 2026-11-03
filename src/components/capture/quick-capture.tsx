"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, FileUp, Loader2, Sparkles, Undo2, Wand2, X, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { analyzeAiImportAction, applyImportRowsAction, type CaptureContextPayload } from "@/app/actions";
import type { AiQuestion } from "@/lib/ai/import-schema";
import { CAPTURE_EXAMPLES, parseCapture, rowToLine, type CaptureContext, type ParsedLine, type Token } from "@/lib/capture/syntax";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { importRowPayload, parseTabularInput, rowFromAiDraft, validateImportRow, type ImportRow, type ImportRowErrors } from "@/lib/import/rows";
import type { Locale } from "@/lib/i18n";
import { cn, formatMoney, slugify } from "@/lib/utils";
import { AppIcon } from "../icons";
import { CaptureCard } from "./capture-card";
import { CategoryList } from "./editors";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Chip, Kbd, TOKEN_DOT, TOKEN_STYLES, monthlyEquivalent, tx } from "./shared";

const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code as string);

type Suggestion = { key: string; label: string; insert: string; icon?: ReactNode; detail?: string };

export type CaptureSaveResult = { created: number[]; updated: number; paid: number };

/** Renders one line's text with its tokens coloured; whitespace stays as-is so it lines up with the textarea. */
function HighlightedLine({ text, tokens }: { text: string; tokens: Token[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((token, index) => {
    if (token.start > cursor) parts.push(text.slice(cursor, token.start));
    parts.push(
      <span
        key={index}
        className={cn("rounded-[4px]", TOKEN_STYLES[token.kind], !token.ok && "text-red-200 underline decoration-red-400 decoration-wavy underline-offset-4 shadow-none bg-red-500/10")}
      >
        {text.slice(token.start, token.end)}
      </span>,
    );
    cursor = token.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function wordAt(text: string, caret: number) {
  let start = caret;
  let quoted = false;
  for (let i = 0; i < caret; i += 1) if (text[i] === '"') quoted = !quoted;
  while (start > 0 && (quoted || !/\s/.test(text[start - 1]))) {
    start -= 1;
    if (text[start] === '"') quoted = !quoted;
  }
  let end = caret;
  while (end < text.length && !/\s/.test(text[end])) end += 1;
  return { start, end, word: text.slice(start, caret) };
}

function lineAt(text: string, caret: number) {
  const start = text.lastIndexOf("\n", caret - 1) + 1;
  const endIndex = text.indexOf("\n", caret);
  const end = endIndex < 0 ? text.length : endIndex;
  return { start, end, index: text.slice(0, start).split("\n").length - 1 };
}

function quoteIfSpaces(value: string) {
  return /\s/.test(value) ? `"${value.replace(/"/g, "'")}"` : value;
}

export function QuickCapture({
  open,
  onOpenChange,
  payload,
  loading,
  initialText,
  defaultCategoryId,
  locale,
  onSaved,
  onOpenEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: CaptureContextPayload | null;
  loading: boolean;
  initialText: string;
  defaultCategoryId: number | null;
  locale: Locale;
  onSaved: (result: CaptureSaveResult) => void;
  onOpenEntry?: (id: number) => void;
}) {
  const [text, setText] = useState(initialText);
  const [caret, setCaret] = useState(0);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [categoryOverride, setCategoryOverride] = useState<number | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<number, ImportRowErrors>>({});
  const [serverMessage, setServerMessage] = useState("");
  const [aiState, setAiState] = useState<{ original: string; summary: string; questions: AiQuestion[]; answers: Record<string, string> } | null>(null);
  const [aiHint, setAiHint] = useState(false);
  const [aiError, setAiError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isThinking, startThinking] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const defaultCategory = categoryOverride === undefined ? defaultCategoryId : categoryOverride;
  const context: CaptureContext = useMemo(
    () => ({
      categories: payload?.categories || [],
      vendors: payload?.vendors || [],
      entries: payload?.entries || [],
      defaultCategoryId: defaultCategory,
      defaultCurrency: payload?.defaultCurrency || "USD",
    }),
    [payload, defaultCategory],
  );
  const parsed = useMemo(() => parseCapture(text, context), [text, context]);
  const parsedByLine = useMemo(() => new Map(parsed.map((line) => [line.index, line])), [parsed]);
  const lines = text.split("\n");
  const readOnly = payload?.readOnly ?? false;
  const ru = locale === "ru";

  // Keep the colour layer scrolled with the textarea and size the textarea to its content.
  function fitTextarea() {
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = "0px";
    area.style.height = `${Math.min(Math.max(area.scrollHeight, 64), 260)}px`;
    if (mirrorRef.current) mirrorRef.current.scrollTop = area.scrollTop;
  }
  useLayoutEffect(fitTextarea, [text, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const area = textareaRef.current;
      if (!area) return;
      fitTextarea();
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
      setCaret(area.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Autocomplete for the word under the caret: #category, @vendor, @vendor/account, or field keys.
  const suggestions: Suggestion[] = useMemo(() => {
    if (!payload) return [];
    const { word } = wordAt(text, caret);
    if (word.startsWith("#")) {
      const query = slugify(word.slice(1).replace(/"/g, ""));
      return context.categories
        .filter((category) => !query || slugify(category.name).includes(query))
        .slice(0, 6)
        .map((category) => ({
          key: `c${category.id}`,
          label: category.name,
          insert: `#${slugify(category.name)}`,
          icon: <AppIcon name={category.icon} className="h-3.5 w-3.5" />,
          detail: category.fields.length ? category.fields.map((field) => field.label).slice(0, 3).join(", ") : undefined,
        }));
    }
    if (word.startsWith("@")) {
      const body = word.slice(1);
      const slash = body.indexOf("/");
      if (slash >= 0) {
        const vendor = body.slice(0, slash).replace(/"/g, "");
        const query = body.slice(slash + 1).toLowerCase();
        return [...new Set(context.vendors.filter((item) => item.vendorName.toLowerCase() === vendor.toLowerCase()).map((item) => item.accountName).filter(Boolean))]
          .filter((account) => account.toLowerCase().includes(query))
          .slice(0, 6)
          .map((account) => ({ key: `a${account}`, label: account, insert: `@${quoteIfSpaces(vendor)}/${quoteIfSpaces(account)}`, detail: vendor }));
      }
      const query = body.replace(/"/g, "").toLowerCase();
      return [...new Set(context.vendors.map((item) => item.vendorName).filter(Boolean))]
        .filter((vendor) => vendor.toLowerCase().includes(query))
        .slice(0, 6)
        .map((vendor) => ({ key: `v${vendor}`, label: vendor, insert: `@${quoteIfSpaces(vendor)}` }));
    }
    return [];
  }, [caret, context.categories, context.vendors, payload, text]);
  const showSuggestions = suggestions.length > 0 && !suggestionsDismissed;

  // Field hints for the line under the caret: the category's fields not yet filled.
  const currentLine = parsedByLine.get(lineAt(text, caret).index);
  const fieldHints = useMemo(() => {
    if (!currentLine) return [];
    const category = context.categories.find((candidate) => candidate.id === currentLine.row.categoryId);
    if (!category) return [];
    return category.fields.filter((field) => {
      const value = currentLine.row.customFields[field.id];
      return value === undefined || value === "" || value === null;
    });
  }, [context.categories, currentLine]);

  const rowErrors = useMemo(() => {
    const result: Record<number, ImportRowErrors> = {};
    parsed.forEach((line) => {
      const rowValid = validateImportRow({ ...line.row, amountInput: line.row.amountInput || "0" }, context.categories, CURRENCY_CODES, ru);
      if (Object.keys(rowValid).length) result[line.index] = rowValid;
    });
    return result;
  }, [context.categories, parsed, ru]);

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    parsed.forEach((line) => {
      if (line.row.action !== "create") return;
      const value = monthlyEquivalent(Number(line.row.amountInput || 0), line.row.paymentType, line.row.period, Number(line.row.customPeriodDaysInput) || 30);
      if (value) byCurrency.set(line.row.currency, (byCurrency.get(line.row.currency) || 0) + value);
    });
    return [...byCurrency.entries()];
  }, [parsed]);
  const counts = {
    create: parsed.filter((line) => line.row.action === "create").length,
    edit: parsed.filter((line) => line.row.action === "edit").length,
    pay: parsed.filter((line) => line.row.action === "pay").length,
  };

  function updateText(next: string, nextCaret?: number) {
    setText(next);
    setErrors({});
    setServerMessage("");
    setSuggestionsDismissed(false);
    setSelectedSuggestion(0);
    if (nextCaret !== undefined) {
      requestAnimationFrame(() => {
        const area = textareaRef.current;
        if (!area) return;
        area.focus();
        area.setSelectionRange(nextCaret, nextCaret);
        setCaret(nextCaret);
      });
    }
  }

  function acceptSuggestion(suggestion: Suggestion) {
    const { start, end } = wordAt(text, caret);
    const before = text.slice(0, start);
    const after = text.slice(end);
    const insert = `${suggestion.insert}${after.startsWith(" ") ? "" : " "}`;
    updateText(before + insert + after, before.length + insert.length);
  }

  function insertAtCaret(snippet: string) {
    const area = textareaRef.current;
    const position = area?.selectionStart ?? text.length;
    const before = text.slice(0, position);
    const after = text.slice(position);
    const pad = before && !/\s$/.test(before) ? " " : "";
    const insert = `${pad}${snippet}`;
    updateText(before + insert + after, before.length + insert.length);
  }

  function replaceLine(index: number, row: ImportRow) {
    const next = [...lines];
    next[index] = rowToLine(row, context);
    updateText(next.join("\n"));
  }

  function removeLine(index: number) {
    const next = lines.filter((_, lineIndex) => lineIndex !== index);
    updateText(next.join("\n"));
  }

  function convertTabular(raw: string) {
    if (!payload) return false;
    const result = parseTabularInput(raw, context.categories, defaultCategory ?? null);
    if (!result?.rows.length) return false;
    const converted = result.rows.map((row) => rowToLine(row, context)).join("\n");
    const base = text.trim() ? `${text.replace(/\s+$/, "")}\n` : "";
    updateText(base + converted, (base + converted).length);
    setNotice(tx(locale, `Turned ${result.rows.length} ${result.format.toUpperCase()} rows into lines. Check the cards, then save.`, `${result.rows.length} строк ${result.format.toUpperCase()} превращены в строки ввода. Проверьте карточки и сохраните.`));
    return true;
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const raw = event.clipboardData.getData("text/plain");
    if (!raw) return;
    if (convertTabular(raw)) {
      event.preventDefault();
      return;
    }
    const lineCount = raw.trim().split("\n").length;
    if (lineCount >= 2 || raw.length > 140) setAiHint(true);
  }

  async function readFile(file: File) {
    const content = await file.text();
    if (!convertTabular(content)) {
      const base = text.trim() ? `${text.replace(/\s+$/, "")}\n` : "";
      updateText(base + content.trim());
      setAiHint(true);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  function runAi(answers: Record<string, string> = {}) {
    if (!payload?.aiAvailable) return;
    const source = aiState?.original ?? text;
    if (!source.trim()) return;
    setAiError("");
    setAiHint(false);
    startThinking(async () => {
      try {
        const result = await analyzeAiImportAction(source, answers, payload.workspaceId);
        const converted = result.items.map((draft, index) => rowToLine(rowFromAiDraft(draft, index), context));
        setAiState({ original: source, summary: result.summary, questions: result.questions, answers });
        updateText(converted.join("\n"));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        setAiError(tx(locale, `AI could not read that${reason ? ` (${reason})` : ""}. Your text is untouched.`, `AI не смог разобрать текст${reason ? ` (${reason})` : ""}. Текст не изменён.`));
      }
    });
  }

  function restoreOriginal() {
    if (!aiState) return;
    updateText(aiState.original);
    setAiState(null);
  }

  function save() {
    if (!payload || readOnly || !parsed.length || isSaving) return;
    if (Object.keys(rowErrors).length) {
      setErrors(rowErrors);
      setServerMessage(tx(locale, "Fix the highlighted cards first.", "Сначала исправьте отмеченные карточки."));
      return;
    }
    const rows = parsed.map((line) => importRowPayload({ ...line.row, rowKey: `line-${line.index}`, amountInput: line.row.amountInput || "0" }));
    startSaving(async () => {
      const result = await applyImportRowsAction({ workspaceId: payload.workspaceId, rows });
      if (!result.success) {
        const mapped: Record<number, ImportRowErrors> = {};
        result.rowErrors.forEach((error) => {
          const index = Number(error.rowKey.replace("line-", ""));
          mapped[index] = { ...(mapped[index] || {}), [String(error.field)]: error.message };
        });
        setErrors(mapped);
        setServerMessage(result.message || tx(locale, "Some cards need attention.", "Некоторые карточки требуют внимания."));
        return;
      }
      const createdKeys = new Set(parsed.filter((line) => line.row.action === "create").map((line) => `line-${line.index}`));
      onSaved({
        created: result.saved.filter((saved) => createdKeys.has(saved.rowKey)).map((saved) => saved.itemId),
        updated: counts.edit,
        paid: counts.pay,
      });
      setText("");
      setAiState(null);
      setNotice("");
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (showSuggestions) {
      if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey && suggestions.length > 1 && selectedSuggestion < suggestions.length - 1 && event.ctrlKey)) {
        event.preventDefault();
        setSelectedSuggestion((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.metaKey && !event.ctrlKey)) {
        event.preventDefault();
        acceptSuggestion(suggestions[Math.min(selectedSuggestion, suggestions.length - 1)]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSuggestionsDismissed(true);
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
      event.preventDefault();
      runAi(aiState?.answers);
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey || !event.shiftKey)) {
      event.preventDefault();
      save();
    }
  }

  const syncCaret = () => setCaret(textareaRef.current?.selectionStart ?? 0);
  const categoryChip = context.categories.find((category) => category.id === defaultCategory);
  const hasText = text.trim().length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="capture-overlay-in fixed inset-0 z-50 bg-black/60 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="capture-panel-in fixed left-1/2 top-[7vh] z-50 flex max-h-[86vh] w-[calc(100vw-1.5rem)] max-w-[780px] -translate-x-1/2 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0c11]/95 shadow-[0_40px_120px_-30px_rgba(91,33,182,0.55)] outline-none"
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Dialog.Title className="sr-only">{tx(locale, "Quick capture", "Быстрое добавление")}</Dialog.Title>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          {dragging ? (
            <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-[18px] border-2 border-dashed border-violet-400/50 bg-violet-500/10 text-sm font-medium text-violet-100">
              {tx(locale, "Drop a CSV, JSON or text file", "Перетащите CSV, JSON или текстовый файл")}
            </div>
          ) : null}

          {/* Context bar */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-xs text-zinc-500">
            <Zap className="h-3.5 w-3.5 text-violet-300" />
            <span className="font-medium text-zinc-300">{tx(locale, "Quick capture", "Быстрое добавление")}</span>
            {payload ? <span className="hidden truncate sm:inline">· {payload.workspaceName}</span> : null}
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-zinc-400 transition hover:border-white/20 hover:text-zinc-200">
                  {categoryChip ? <AppIcon name={categoryChip.icon} className="h-3 w-3" /> : null}
                  {categoryChip ? tx(locale, `into ${categoryChip.name}`, `в ${categoryChip.name}`) : tx(locale, "no default category", "без категории по умолчанию")}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{tx(locale, "Lines without #category go to", "Строки без #категории попадут в")}</p>
                <CategoryList categories={context.categories} value={defaultCategory ?? null} locale={locale} onSelect={(id) => setCategoryOverride(id)} />
              </PopoverContent>
            </Popover>
            <div className="ml-auto hidden items-center gap-3 sm:flex">
              <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd>{tx(locale, "save", "сохранить")}</span>
              <span className="flex items-center gap-1"><Kbd>⇧</Kbd><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd>{tx(locale, "next line", "новая строка")}</span>
              {payload?.aiAvailable ? <span className="flex items-center gap-1"><Kbd>⌘J</Kbd>AI</span> : null}
            </div>
            <Dialog.Close className="ml-2 rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Close", "Закрыть")}>
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Editor */}
          <div className="relative px-1">
            <div
              ref={mirrorRef}
              aria-hidden
              className="pointer-events-none absolute inset-x-1 inset-y-0 overflow-hidden whitespace-pre-wrap break-words px-5 py-4 text-[17px] font-medium leading-8 text-zinc-50"
            >
              {lines.map((line, index) => {
                const parsedLine = parsedByLine.get(index);
                return (
                  <span key={index}>
                    {parsedLine ? <HighlightedLine text={line} tokens={parsedLine.tokens} /> : line}
                    {index < lines.length - 1 ? "\n" : "​"}
                  </span>
                );
              })}
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              rows={1}
              spellCheck={false}
              disabled={readOnly}
              placeholder={readOnly ? tx(locale, "You can only view this workspace.", "У вас доступ только на просмотр.") : tx(locale, "What are you paying for?  hz-fsn-01 #servers @Hetzner €4.51/mo", "За что вы платите?  hz-fsn-01 #servers @Hetzner €4.51/mo")}
              onChange={(event) => { updateText(event.target.value); setCaret(event.target.selectionStart); }}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              onPaste={onPaste}
              onScroll={(event) => { if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop; }}
              className="relative block w-full resize-none bg-transparent px-5 py-4 text-[17px] font-medium leading-8 text-transparent caret-violet-300 outline-none selection:bg-violet-500/35 selection:text-transparent placeholder:text-zinc-600"
            />
            {isThinking ? <div className="capture-shimmer pointer-events-none absolute inset-0" /> : null}
          </div>

          {/* Autocomplete + field hints */}
          {showSuggestions ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] bg-white/[0.02] px-5 py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.key}
                  type="button"
                  onMouseDown={(event) => { event.preventDefault(); acceptSuggestion(suggestion); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition",
                    index === selectedSuggestion ? "bg-violet-500/25 text-violet-50 ring-1 ring-violet-400/40" : "text-zinc-300 hover:bg-white/[0.06]",
                  )}
                >
                  {suggestion.icon}
                  {suggestion.label}
                  {suggestion.detail ? <span className="text-xs text-zinc-500">{suggestion.detail}</span> : null}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500"><Kbd>Tab</Kbd>{tx(locale, "accept", "выбрать")}</span>
            </div>
          ) : fieldHints.length && hasText ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] bg-white/[0.02] px-5 py-2 text-xs text-zinc-500">
              <span>{tx(locale, "Add fields:", "Поля:")}</span>
              {fieldHints.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onMouseDown={(event) => { event.preventDefault(); insertAtCaret(`${slugify(field.label) || field.id}:`); }}
                  className="rounded-md bg-fuchsia-500/10 px-1.5 py-0.5 font-mono text-[11px] text-fuchsia-200 transition hover:bg-fuchsia-500/20"
                >
                  {slugify(field.label) || field.id}:
                </button>
              ))}
            </div>
          ) : null}

          {/* Body: cards or onboarding */}
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06]">
            {loading && !payload ? (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />{tx(locale, "Loading workspace…", "Загрузка…")}</div>
            ) : null}

            {aiState ? (
              <div className="mx-4 mt-4 rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                  <p className="flex-1 text-sm text-violet-100">{aiState.summary || tx(locale, "AI rewrote your text as capture lines.", "AI переписал текст в строки ввода.")}</p>
                  <button type="button" onClick={restoreOriginal} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs text-violet-200 transition hover:bg-violet-500/15">
                    <Undo2 className="h-3.5 w-3.5" />{tx(locale, "Original text", "Исходный текст")}
                  </button>
                </div>
                {aiState.questions.map((question) => (
                  <div key={question.id} className="mt-2 pl-6">
                    <p className="text-xs text-zinc-300">{question.question}{question.itemName ? <span className="text-zinc-500"> · {question.itemName}</span> : null}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {question.suggestions.map((answer) => (
                        <Chip key={answer} tone={aiState.answers[question.id] === answer ? "violet" : "default"} onClick={() => runAi({ ...aiState.answers, [question.id]: answer })}>
                          {answer}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {aiError ? <p className="mx-5 mt-4 text-sm text-red-300">{aiError}</p> : null}
            {notice ? <p className="mx-5 mt-4 text-xs text-emerald-200/90">{notice}</p> : null}

            {(aiHint || (parsed.some((line) => line.tokens.length > 8 && line.tokens.every((token) => token.kind === "name")))) && !aiState && hasText ? (
              <button
                type="button"
                onClick={() => runAi()}
                disabled={!payload?.aiAvailable || isThinking}
                className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-transparent p-3 text-left transition hover:border-violet-300/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/20 text-violet-200"><Wand2 className="h-4 w-4" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-violet-50">{tx(locale, "This looks like free text. Let AI sort it into entries?", "Похоже на свободный текст. Разобрать с помощью AI?")}</span>
                  <span className="block text-xs text-zinc-400">
                    {payload?.aiAvailable
                      ? tx(locale, "IPs, domains, logins and names are masked before anything is sent.", "IP, домены, логины и названия маскируются перед отправкой.")
                      : tx(locale, "AI needs Premium and an API key in .env.local.", "Нужен Premium и ключ API в .env.local.")}
                  </span>
                </span>
                {payload?.aiAvailable ? <Kbd>⌘J</Kbd> : null}
              </button>
            ) : null}

            {isThinking ? (
              <div className="space-y-3 p-4">
                {[0, 1].map((key) => <div key={key} className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />)}
              </div>
            ) : parsed.length ? (
              <div className="space-y-3 p-4">
                {parsed.map((line, index) => (
                  <CaptureCard
                    key={`${line.index}`}
                    index={index}
                    parsed={line as ParsedLine}
                    context={context}
                    errors={errors[line.index] || {}}
                    locale={locale}
                    onChange={(row) => replaceLine(line.index, row)}
                    onRemove={() => removeLine(line.index)}
                    onOpenExisting={onOpenEntry ? (id) => { onOpenChange(false); onOpenEntry(id); } : undefined}
                  />
                ))}
              </div>
            ) : payload && !loading ? (
              <Onboarding locale={locale} onExample={(example) => updateText(example, example.length)} onFile={() => fileRef.current?.click()} />
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-black/20 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {parsed.length ? (
                <>
                  {counts.create ? <span className="text-zinc-300">{tx(locale, `${counts.create} new`, `${counts.create} новых`)}</span> : null}
                  {counts.edit ? <span className="text-orange-200">{tx(locale, `${counts.edit} update`, `${counts.edit} изм.`)}</span> : null}
                  {counts.pay ? <span className="text-emerald-200">{tx(locale, `${counts.pay} payment`, `${counts.pay} оплат`)}</span> : null}
                  {totals.length ? (
                    <span className="text-emerald-300/90">+{totals.map(([currency, value]) => formatMoney(value, currency)).join(" + ")} {tx(locale, "/ month", "/ мес")}</span>
                  ) : null}
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <FileUp className="h-3.5 w-3.5" />
                  {tx(locale, "Paste a table or drop a file. Each line becomes an entry.", "Вставьте таблицу или файл. Каждая строка станет записью.")}
                </span>
              )}
              {serverMessage ? <span className="text-red-300">{serverMessage}</span> : null}
            </div>
            {payload?.aiAvailable && hasText ? (
              <button type="button" onClick={() => runAi(aiState?.answers)} disabled={isThinking} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-400/20 px-3 text-sm text-violet-100 transition hover:bg-violet-500/15 disabled:opacity-50">
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiState ? tx(locale, "Ask again", "Ещё раз") : tx(locale, "AI", "AI")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              disabled={!parsed.length || isSaving || readOnly || isThinking}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {parsed.length > 1 ? tx(locale, `Save ${parsed.length}`, `Сохранить ${parsed.length}`) : tx(locale, "Save", "Сохранить")}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.json,.txt,text/csv,application/json,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.target.value = "";
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Onboarding({ locale, onExample, onFile }: { locale: Locale; onExample: (text: string) => void; onFile: () => void }) {
  const legend: Array<{ kind: keyof typeof TOKEN_DOT; syntax: string; en: string; ru: string }> = [
    { kind: "category", syntax: "#servers", en: "category", ru: "категория" },
    { kind: "vendor", syntax: "@Hetzner/login", en: "vendor / account", ru: "поставщик / аккаунт" },
    { kind: "money", syntax: "€4.51/mo", en: "price & period", ru: "цена и период" },
    { kind: "date", syntax: "2026-12-01", en: "renews on", ru: "дата продления" },
    { kind: "field", syntax: "ip:1.2.3.4", en: "any field", ru: "любое поле" },
    { kind: "notes", syntax: "// text", en: "notes", ru: "заметка" },
  ];
  return (
    <div className="space-y-5 p-5">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">{tx(locale, "Try one", "Попробуйте")}</p>
        <div className="space-y-1.5">
          {CAPTURE_EXAMPLES.map((example) => (
            <button key={example} type="button" onClick={() => onExample(example)} className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left font-mono text-[13px] text-zinc-400 transition hover:border-violet-400/30 hover:bg-violet-500/[0.06] hover:text-zinc-100">
              <span className="flex-1 truncate">{example}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {legend.map((item) => (
          <div key={item.syntax} className="flex items-center gap-2 text-xs">
            <span className={cn("h-1.5 w-1.5 rounded-full", TOKEN_DOT[item.kind])} />
            <code className={cn("rounded px-1 font-mono", TOKEN_STYLES[item.kind])}>{item.syntax}</code>
            <span className="text-zinc-500">{tx(locale, item.en, item.ru)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-zinc-500">
        {tx(locale, "Only the name is required. Everything is optional and editable on the card. Got a spreadsheet or an invoice? Paste it,", "Обязательно только название, остальное можно поправить на карточке. Есть таблица или счёт? Вставьте её,")}{" "}
        <button type="button" onClick={onFile} className="text-violet-300 underline-offset-2 hover:underline">{tx(locale, "pick a file", "выберите файл")}</button>{" "}
        {tx(locale, "or drop it here.", "или перетащите сюда.")}
      </p>
    </div>
  );
}
