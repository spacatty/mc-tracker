"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, CalendarDays, ChevronDown, Coins, CornerDownLeft, KeyRound, Plus, Repeat, Store, Tag, Tags, FileUp, Loader2, Sparkles, Undo2, Wand2, X, Zap } from "lucide-react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { analyzeAiImportAction, applyImportRowsAction, type CaptureContextPayload } from "@/app/actions";
import type { AiQuestion } from "@/lib/ai/import-schema";
import { parseCapture, parseDate, rowToLine, type CaptureContext, type ParsedLine, type Token } from "@/lib/capture/syntax";
import { format } from "date-fns";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { importRowPayload, parseTabularInput, rowFromAiDraft, validateImportRow, type ImportRow, type ImportRowErrors } from "@/lib/import/rows";
import type { Locale } from "@/lib/i18n";
import { cn, formatMoney, slugify } from "@/lib/utils";
import { AppIcon } from "../icons";
import { CaptureCard } from "./capture-card";
import { CategoryList } from "./editors";
import { DateCalendar } from "../ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { LetterIcon, SuggestMenu } from "./suggest-menu";
import { Chip, Kbd, TOKEN_DOT, TOKEN_STYLES, monthlyEquivalent, tx } from "./shared";

const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code as string);

/** `calendar` items open the date picker instead of inserting text. */
type Suggestion = { key: string; label: string; insert: string; replace?: boolean; icon?: ReactNode; detail?: string; match?: string; calendar?: boolean };
type GuideStep = "category" | "name" | "vendor" | "account" | "price" | "date";
type Guide = { step: GuideStep | "done" | "field"; steps: GuideStep[]; done: Set<GuideStep>; suggestions: Suggestion[]; question: string };

const STEP_LABELS: Record<GuideStep, [string, string]> = {
  category: ["Category", "Категория"],
  name: ["Name", "Название"],
  vendor: ["Vendor", "Поставщик"],
  account: ["Account", "Аккаунт"],
  price: ["Price", "Цена"],
  date: ["Billing start", "Начало оплаты"],
};
const STEP_ICONS: Record<string, ReactNode> = {
  category: <Tags className="h-3 w-3" />,
  vendor: <Store className="h-3 w-3" />,
  account: <KeyRound className="h-3 w-3" />,
  price: <Coins className="h-3 w-3" />,
  date: <CalendarDays className="h-3 w-3" />,
  field: <Tag className="h-3 w-3" />,
};
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", RUB: "₽" };
const SYMBOL_CODES: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₽": "RUB", "¥": "JPY" };
const ACCOUNT_WORD = /^(acc|account|login|user):/i;
const DATE_WORD = /^\d{1,4}[./-]\d{0,2}([./-]\d{0,4})?$/;
const PERIOD_WORD = /^\/(w|wk|week|m|mo|mon|month|q|y|yr|year|once|\d+d)$/i;
const PERIOD_CHOICES = [
  { token: "/mo", en: "monthly", ru: "в месяц" },
  { token: "/yr", en: "yearly", ru: "в год" },
  { token: "/q", en: "quarterly", ru: "в квартал" },
  { token: "/w", en: "weekly", ru: "в неделю" },
  { token: "/once", en: "one-time", ru: "разово" },
];

/** 3 = prefix, 2 = substring, 1 = letters in order (typo-tolerant-ish), 0 = no match. */
function fuzzyScore(query: string, label: string) {
  const q = query.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const l = label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (!q) return 1;
  if (l.startsWith(q)) return 3;
  if (l.includes(q)) return 2;
  let index = 0;
  for (const char of l) if (char === q[index]) index += 1;
  return index === q.length && q.length >= 2 ? 1 : 0;
}

function preferredCurrencies(context: CaptureContext) {
  const counts = new Map<string, number>();
  context.entries.forEach((entry) => counts.set(entry.currency, (counts.get(entry.currency) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}

function dottedDate(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`;
}

function formatHuman(iso: string, locale: Locale) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

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
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [categoryOverride, setCategoryOverride] = useState<number | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<number, ImportRowErrors>>({});
  const [serverMessage, setServerMessage] = useState("");
  const [aiState, setAiState] = useState<{ original: string; summary: string; questions: AiQuestion[]; answers: Record<string, string> } | null>(null);
  const [mode, setMode] = useState<"quick" | "ai">("quick");
  const [aiText, setAiText] = useState("");
  // AI never writes notes unless the user opts in.
  const [noNotes, setNoNotes] = useState(true);
  const aiAreaRef = useRef<HTMLTextAreaElement>(null);
  const [aiHint, setAiHint] = useState(false);
  const [aiError, setAiError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isThinking, startThinking] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Radix mounts the dialog content a render after `open`, so placement also re-runs once the menu exists.
  const [menuMounted, setMenuMounted] = useState(false);
  const attachMenu = useCallback((node: HTMLDivElement | null) => {
    menuRef.current = node;
    setMenuMounted(Boolean(node));
  }, []);
  const markerRef = useRef<HTMLSpanElement>(null);
  // Where the billing-start calendar floats (same spot as the menu it replaced), or null when closed.
  const [calendarAt, setCalendarAt] = useState<{ top: string; left: string } | null>(null);
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
  useLayoutEffect(() => {
    fitTextarea();
    // Place the caret in the same commit as the new text so fast typing never lands in the wrong spot.
    const area = textareaRef.current;
    if (area && pendingCaret.current !== null) {
      area.focus();
      area.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text, open]);

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

  // Guided entry: for the line under the caret, work out which step comes next
  // (category → name → vendor → price → billing start) and offer fuzzy suggestions for it.
  const caretLine = lineAt(text, caret);
  const currentLine = parsedByLine.get(caretLine.index);
  const caretWord = wordAt(text, caret).word;
  // A lone "/" waits a moment so typing "//" for a note never flashes field suggestions.
  const [slashReady, setSlashReady] = useState(false);
  useEffect(() => {
    if (caretWord !== "/") return;
    const timer = window.setTimeout(() => setSlashReady(true), 300);
    return () => { window.clearTimeout(timer); setSlashReady(false); };
  }, [caretWord]);
  const guide: Guide = useMemo(() => {
    const steps: GuideStep[] = ["category", "name", "vendor", "account", "price", "date"];
    if (!payload) return { step: "done", steps, done: new Set(), suggestions: [], question: "" };
    const row = currentLine?.row;
    const skippedHere = (step: GuideStep) => skipped.has(`${caretLine.index}:${step}`);
    const done = new Set<GuideStep>();
    if (row && (row.categoryId !== null || skippedHere("category"))) done.add("category");
    if (row?.name) done.add("name");
    if (row && (row.vendorName || skippedHere("vendor"))) done.add("vendor");
    if (row && (row.accountName || skippedHere("account"))) done.add("account");
    if (row && (!currentLine?.assumed.has("amount") || skippedHere("price"))) done.add("price");
    if (row && (!currentLine?.assumed.has("dates") || skippedHere("date"))) done.add("date");
    if (row && row.action !== "create") ["category", "name", "vendor", "account", "date"].forEach((step) => done.add(step as GuideStep));

    const word = caretWord.replace(/"/g, "");
    const plainWord = word && !/^[#@/]/.test(word) && !word.includes(":") ? word : "";
    const accountWord = ACCOUNT_WORD.test(word);
    const wordIsNumber = /^[$€£₽¥]?\d+(?:[.,]\d{0,2})?k?$/i.test(word) && !/^\d{1,2}[./-]\d/.test(word);
    const wordIsMoney = Boolean(currentLine?.tokens.find((token) => token.kind === "money" && token.end === caret - caretLine.start));
    const wordIsDate = DATE_WORD.test(word);

    let step: GuideStep | "done" | "field" = steps.find((candidate) => !done.has(candidate)) || "done";
    if (word.startsWith("!") || (word.startsWith("/") && !word.startsWith("//") && (word !== "/" || slashReady) && !/^\/\d/.test(word) && !PERIOD_WORD.test(word))) step = "field";
    else if (accountWord) step = "account";
    else if (word.startsWith("#")) step = "category";
    else if (word.startsWith("@")) step = "vendor";
    else if (wordIsMoney || wordIsNumber) step = "price";
    else if (wordIsDate) step = "date";

    const suggestions: Suggestion[] = [];
    let question = "";
    if (step === "field") {
      const category = context.categories.find((candidate) => candidate.id === (row?.categoryId ?? null));
      const query = word.slice(1).replace(/:.*$/, "");
      if (!category) question = tx(locale, "Pick a #category first; its fields show up here.", "Сначала выберите #категорию — её поля появятся здесь.");
      else {
        question = tx(locale, `${category.name} fields`, `Поля «${category.name}»`);
        category.fields
          .map((field) => ({ field, score: query ? Math.max(fuzzyScore(query, field.label), fuzzyScore(query, field.id)) : 1 }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .forEach(({ field }) => suggestions.push({ key: `f${field.id}`, label: field.label, insert: `/${slugify(field.label) || field.id}:`, replace: true, match: query, icon: <Tag className="h-3.5 w-3.5 text-zinc-400" />, detail: row?.customFields[field.id] ? String(row.customFields[field.id]) : `/${slugify(field.label) || field.id}` }));
      }
    } else if (step === "category") {
      question = tx(locale, "Which category?", "Какая категория?");
      const query = word.startsWith("#") ? word.slice(1) : plainWord;
      const ranked = context.categories
        .map((category) => ({ category, score: query ? fuzzyScore(query, category.name) : 1 }))
        .filter((entry) => entry.score > 0 || !word.startsWith("#"))
        .sort((a, b) => b.score - a.score);
      ranked.slice(0, 7).forEach(({ category, score }) => suggestions.push({
        key: `c${category.id}`,
        label: category.name,
        insert: `#${slugify(category.name)}`,
        replace: word.startsWith("#") || (Boolean(query) && score >= 2),
        match: query,
        detail: `${category.fields.length ? tx(locale, `${category.fields.length} field${category.fields.length === 1 ? "" : "s"}`, `полей: ${category.fields.length}`) : ""}`,
        icon: <AppIcon name={category.icon} className="h-3.5 w-3.5 text-zinc-300" />,
      }));
    } else if (step === "name") {
      question = tx(locale, "What is it called? Type a name, like hz-fsn-01 or acme.dev", "Как называется? Например hz-fsn-01 или acme.dev");
    } else if (step === "vendor") {
      question = tx(locale, "Who do you pay? (vendor)", "Кому платите? (поставщик)");
      const body = word.startsWith("@") ? word.slice(1) : plainWord;
      const slash = body.indexOf("/");
      if (slash >= 0) {
        const vendor = body.slice(0, slash);
        const query = body.slice(slash + 1);
        question = tx(locale, "Which account?", "Какой аккаунт?");
        [...new Set(context.vendors.filter((item) => item.vendorName.toLowerCase() === vendor.toLowerCase()).map((item) => item.accountName).filter(Boolean))]
          .map((account) => ({ account, score: query ? fuzzyScore(query, account) : 1 }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .forEach(({ account }) => suggestions.push({ key: `a${account}`, label: account, insert: `@${quoteIfSpaces(vendor)}/${quoteIfSpaces(account)}`, replace: true, detail: vendor, match: query, icon: <LetterIcon text={account} /> }));
      } else {
        const counts = new Map<string, number>();
        context.vendors.forEach((item) => { if (item.vendorName) counts.set(item.vendorName, (counts.get(item.vendorName) || 0) + 1); });
        context.entries.forEach((item) => { if (item.vendorName) counts.set(item.vendorName, (counts.get(item.vendorName) || 0) + 1); });
        const ranked = [...counts.entries()]
          .map(([vendor, count]) => ({ vendor, score: body ? fuzzyScore(body, vendor) : 1, count }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score || b.count - a.count);
        ranked.slice(0, 7).forEach(({ vendor, score, count }) => suggestions.push({
          key: `v${vendor}`,
          label: vendor,
          insert: `@${quoteIfSpaces(vendor)}`,
          replace: word.startsWith("@") || (Boolean(body) && score >= 2),
          match: body,
          icon: <LetterIcon text={vendor} />,
          detail: tx(locale, `${count} ${count === 1 ? "entry" : "entries"}`, `${count} зап.`),
        }));
        if (body && word.startsWith("@") && !ranked.some((entry) => entry.vendor.toLowerCase() === body.toLowerCase())) {
          suggestions.push({ key: "v-new", label: tx(locale, `Create “${body}”`, `Создать «${body}»`), insert: `@${quoteIfSpaces(body)}`, replace: true, icon: <Plus className="h-3.5 w-3.5 text-zinc-400" />, detail: tx(locale, "new vendor", "новый") });
        }
      }
    } else if (step === "account") {
      const vendor = row?.vendorName || "";
      question = vendor
        ? tx(locale, `Which account or login at ${vendor}? Type account:name, or skip.`, `Какой аккаунт или логин в ${vendor}? Введите account:имя или пропустите.`)
        : tx(locale, "Which account or login? Type account:name, or skip.", "Какой аккаунт или логин? Введите account:имя или пропустите.");
      const query = accountWord ? word.replace(ACCOUNT_WORD, "") : plainWord;
      // Only offer accounts once something is typed, so Enter at the end of a line still saves.
      if (accountWord || query) {
        const known = [...new Set(context.vendors
          .filter((item) => !vendor || item.vendorName.toLowerCase() === vendor.toLowerCase())
          .map((item) => item.accountName)
          .filter(Boolean))];
        const ranked = known
          .map((account) => ({ account, score: query ? fuzzyScore(query, account) : 1 }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);
        ranked.forEach(({ account }) => suggestions.push({ key: `a${account}`, label: account, insert: `account:${quoteIfSpaces(account)}`, replace: true, detail: vendor, match: query, icon: <LetterIcon text={account} /> }));
        if (query && !ranked.some((entry) => entry.account.toLowerCase() === query.toLowerCase())) {
          suggestions.push({ key: "a-new", label: tx(locale, `Use “${query}”`, `Использовать «${query}»`), insert: `account:${quoteIfSpaces(query)}`, replace: true, icon: <Plus className="h-3.5 w-3.5 text-zinc-400" />, detail: tx(locale, "new account", "новый") });
        }
      }
    } else if (step === "price") {
      if (wordIsMoney && currentLine) {
        question = tx(locale, "How often?", "Как часто?");
        PERIOD_CHOICES.forEach((choice) => suggestions.push({ key: `p${choice.token}`, label: tx(locale, choice.en, choice.ru), insert: `${caretWord.replace(/\/.*$/, "")}${choice.token}`, replace: true, icon: <Repeat className="h-3.5 w-3.5 text-zinc-400" />, detail: choice.token }));
      } else if (wordIsNumber) {
        question = tx(locale, "Which currency, and how often?", "Какая валюта и период?");
        const amount = word.replace(/^[$€£₽¥]/, "");
        const typedSymbol = word.match(/^[$€£₽¥]/)?.[0];
        const codes = typedSymbol ? [SYMBOL_CODES[typedSymbol] || "USD"] : [...new Set([context.defaultCurrency, ...preferredCurrencies(context), "USD", "EUR", "RUB"])].slice(0, 4);
        codes.forEach((code) => {
          ["/mo", "/yr"].forEach((period) => {
            const symbol = CURRENCY_SYMBOLS[code];
            const insert = symbol ? `${symbol}${amount}${period}` : `${amount}${code}${period}`;
            suggestions.push({ key: `m${code}${period}`, label: `${symbol ? `${symbol}${amount}` : `${amount} ${code}`} ${period === "/mo" ? tx(locale, "monthly", "в месяц") : tx(locale, "yearly", "в год")}`, insert, replace: true, icon: <span className="text-[11px] font-semibold text-zinc-300">{symbol || code.slice(0, 1)}</span>, detail: code });
          });
        });
      } else {
        question = tx(locale, "How much? Type it any way: 25 USD, $25, 25€, 2500 RUB, 10/yr", "Сколько? Как угодно: 25 USD, $25, 25€, 2500 RUB, 10/yr");
      }
    } else if (step === "date") {
      question = tx(locale, "When does billing start? Any format: 03.11.2026, 3/11/26, 2026-11-03", "Когда начало оплаты? Любой формат: 03.11.2026, 3/11/26, 2026-11-03");
      const parsedDate = wordIsDate ? parseDate(word) : null;
      if (parsedDate) {
        suggestions.push({ key: "d-typed", label: tx(locale, `Starts ${formatHuman(parsedDate, locale)}`, `С ${formatHuman(parsedDate, locale)}`), insert: caretWord, replace: true, icon: <CalendarDays className="h-3.5 w-3.5 text-zinc-400" />, detail: parsedDate });
      } else if (!wordIsDate) {
        const today = new Date();
        const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        [
          { key: "today", label: tx(locale, "Today", "Сегодня"), date: today },
          { key: "first", label: tx(locale, "1st of this month", "1-е число"), date: first },
        ].forEach((choice) => suggestions.push({ key: `d${choice.key}`, label: choice.label, insert: dottedDate(choice.date), replace: false, detail: dottedDate(choice.date), icon: <CalendarDays className="h-3.5 w-3.5 text-zinc-400" /> }));
      }
      suggestions.push({ key: "d-calendar", label: tx(locale, "Pick on calendar…", "Выбрать в календаре…"), insert: "", calendar: true, icon: <CalendarDays className="h-3.5 w-3.5 text-violet-300" /> });
    } else {
      question = row ? tx(locale, "All set. ↵ saves; add more lines with ⇧↵.", "Готово. ↵ сохранит, ⇧↵ — новая строка.") : "";
    }
    return { step, steps, done, suggestions, question };
  }, [caret, caretLine.index, caretLine.start, caretWord, context, currentLine, locale, payload, skipped, slashReady]);
  const suggestions = guide.suggestions;
  const showSuggestions = open && suggestions.length > 0 && !suggestionsDismissed && !calendarAt;
  const caretWordStart = wordAt(text, caret).start;

  // Float the menu under the word being typed. Offsets are relative to the editor, so the
  // dialog's own position or animation never matters.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const marker = markerRef.current;
    const area = textareaRef.current;
    if (!showSuggestions || !menu || !marker || !area) return;
    const top = Math.min(marker.offsetTop + marker.offsetHeight - area.scrollTop, area.offsetHeight) + 4;
    const maxLeft = Math.max(8, area.offsetWidth - menu.offsetWidth - 8);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.min(Math.max(8, marker.offsetLeft - 10), maxLeft)}px`;
  }, [menuMounted, showSuggestions, caretWordStart, text, suggestions.length]);

  // Optional category fields not filled yet on the caret line, offered once the main steps are done.
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
    setCalendarAt(null);
    setErrors({});
    setServerMessage("");
    setSuggestionsDismissed(false);
    setSelectedSuggestion(0);
    if (nextCaret !== undefined) {
      pendingCaret.current = nextCaret;
      setCaret(nextCaret);
    }
  }

  function acceptSuggestion(suggestion: Suggestion) {
    if (suggestion.calendar) {
      setCalendarAt({ top: menuRef.current?.style.top || "72px", left: menuRef.current?.style.left || "8px" });
      return;
    }
    if (!suggestion.replace) {
      // Keep what was typed (usually the name) and add the suggestion after it.
      const { end } = wordAt(text, caret);
      const before = text.slice(0, end);
      const after = text.slice(end);
      const pad = before && !/\s$/.test(before) ? " " : "";
      const insert = `${pad}${suggestion.insert}${after.startsWith(" ") ? "" : " "}`;
      updateText(before + insert + after, before.length + insert.length);
      return;
    }
    const { start, end } = wordAt(text, caret);
    // "25 USD" style money spans two words; replace both.
    const tokenStart = currentLine?.tokens.find((token) => token.kind === "money" && caretLine.start + token.end === end)?.start;
    const from = tokenStart !== undefined ? caretLine.start + tokenStart : start;
    const before = text.slice(0, from);
    const after = text.slice(end);
    const insert = `${suggestion.insert}${after.startsWith(" ") ? "" : " "}`;
    updateText(before + insert + after, before.length + insert.length);
  }

  function pickCalendarDate(date?: Date) {
    if (!date) return;
    // A half-typed date under the caret is replaced; otherwise the date is added after it.
    acceptSuggestion({ key: "d-picked", label: "", insert: format(date, "dd.MM.yyyy"), replace: DATE_WORD.test(caretWord) });
  }

  function closeCalendar() {
    setCalendarAt(null);
    textareaRef.current?.focus();
  }

  function skipStep() {
    if (guide.step === "done") return;
    setSkipped((current) => new Set(current).add(`${caretLine.index}:${guide.step}`));
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

  function runAi(answers: Record<string, string> = {}, sourceText?: string) {
    if (!payload?.aiAvailable) return;
    const source = sourceText ?? aiState?.original ?? text;
    if (!source.trim()) return;
    setAiError("");
    setAiHint(false);
    startThinking(async () => {
      try {
        const result = await analyzeAiImportAction(source, answers, payload.workspaceId, { noNotes });
        const converted = result.items.map((draft, index) => rowToLine(rowFromAiDraft(draft, index), context));
        setAiState({ original: source, summary: result.summary, questions: result.questions, answers });
        setMode("quick");
        updateText(converted.join("\n"));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        setAiError(tx(locale, `AI could not read that${reason ? ` (${reason})` : ""}. Your text is untouched.`, `AI не смог разобрать текст${reason ? ` (${reason})` : ""}. Текст не изменён.`));
      }
    });
  }

  function restoreOriginal() {
    if (!aiState) return;
    setAiText(aiState.original);
    setAiState(null);
    updateText("");
    setMode("ai");
  }

  /** Free text goes to the AI tab instead of being parsed line by line. */
  function sendToAi() {
    setAiText(text);
    setMode("ai");
    setAiHint(false);
  }

  function onAiKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      runAi({}, aiText);
    }
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
    if (calendarAt && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeCalendar();
      return;
    }
    if (showSuggestions) {
      const cycling = Boolean(caretWord) || !text.includes("\n");
      if (cycling && event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedSuggestion((current) => (current + 1) % suggestions.length);
        return;
      }
      if (cycling && event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }
      // Enter picks the highlighted item, like Tab. Ctrl/⌘+Enter (below) always saves.
      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        acceptSuggestion(suggestions[Math.min(selectedSuggestion, suggestions.length - 1)]);
        return;
      }
    }
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      if (showSuggestions) acceptSuggestion(suggestions[Math.min(selectedSuggestion, suggestions.length - 1)]);
      else skipStep();
      return;
    }
    if (event.key === "Escape" && showSuggestions) {
      event.preventDefault();
      event.stopPropagation();
      setSuggestionsDismissed(true);
      return;
    }
    if (event.key === "Escape" && guide.step !== "done" && currentLine) {
      event.preventDefault();
      event.stopPropagation();
      skipStep();
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
          className="capture-panel-in fixed inset-x-0 top-[22vh] z-50 mx-auto flex max-h-[74vh] w-[calc(100vw-1.5rem)] max-w-[840px] flex-col rounded-2xl border border-white/10 bg-[#101013] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] outline-none"
          // Closes only from the X button: Escape and outside clicks would throw away what was typed.
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Dialog.Title className="sr-only">{tx(locale, "Quick capture", "Быстрое добавление")}</Dialog.Title>
          {dragging ? (
            <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-[18px] border-2 border-dashed border-white/20 bg-white/[0.04] text-sm font-medium text-zinc-200">
              {tx(locale, "Drop a CSV, JSON or text file", "Перетащите CSV, JSON или текстовый файл")}
            </div>
          ) : null}

          {/* Context bar: mode tabs, default category, close. Keyboard hints live in the menu and footer. */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-5 text-[13px]">
            <div role="tablist" aria-label={tx(locale, "Capture mode", "Режим")} className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
              {([
                ["quick", <Zap key="i" className="h-3.5 w-3.5" />, tx(locale, "Quick", "Быстро")],
                ["ai", <Sparkles key="i" className="h-3.5 w-3.5" />, tx(locale, "AI import", "AI-импорт")],
              ] as const).map(([value, icon, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    if (value === "ai" && !aiText && text.trim() && !aiState) setAiText(text);
                    requestAnimationFrame(() => (value === "ai" ? aiAreaRef : textareaRef).current?.focus());
                  }}
                  className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium transition", mode === value ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:text-zinc-300")}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
            {mode === "quick" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title={tx(locale, "Lines without #category go here", "Строки без #категории попадут сюда")}
                    className="inline-flex h-7 min-w-0 max-w-[14rem] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200"
                  >
                    {categoryChip ? <AppIcon name={categoryChip.icon} className="h-3.5 w-3.5 shrink-0" /> : <Tags className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{categoryChip ? categoryChip.name : tx(locale, "Any category", "Любая категория")}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{tx(locale, "Lines without #category go to", "Строки без #категории попадут в")}</p>
                  <CategoryList categories={context.categories} value={defaultCategory ?? null} locale={locale} onSelect={(id) => setCategoryOverride(id)} />
                </PopoverContent>
              </Popover>
            ) : null}
            <Dialog.Close className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" aria-label={tx(locale, "Close", "Закрыть")}>
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {mode === "ai" ? (
            <AiImportPane
              ref={aiAreaRef}
              locale={locale}
              value={aiText}
              onChange={setAiText}
              onKeyDown={onAiKeyDown}
              noNotes={noNotes}
              onNoNotesChange={setNoNotes}
              aiAvailable={Boolean(payload?.aiAvailable)}
              thinking={isThinking}
              error={aiError}
            />
          ) : (
          <>
          {/* Editor */}
          <div className="relative z-20">
            <div
              ref={mirrorRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-7 py-6 text-[17px] font-medium leading-8 text-zinc-50"
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
            <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 whitespace-pre-wrap break-words px-7 py-6 text-[17px] font-medium leading-8">
              {text.slice(0, caretWordStart)}<span ref={markerRef}>{text.slice(caretWordStart, caret) || "​"}</span>
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
              onMouseDown={() => setCalendarAt(null)}
              onSelect={syncCaret}
              onPaste={onPaste}
              onScroll={(event) => { if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop; }}
              className="relative block w-full resize-none bg-transparent px-7 py-6 text-[17px] font-medium leading-8 text-transparent caret-zinc-100 outline-none selection:bg-violet-500/35 selection:text-transparent placeholder:text-zinc-600"
            />
            {isThinking ? <div className="capture-shimmer pointer-events-none absolute inset-0" /> : null}
            {showSuggestions ? (
              <SuggestMenu
                ref={attachMenu}
                title={guide.step === "field" ? guide.question : STEP_LABELS[guide.step as GuideStep]?.[ru ? 1 : 0] || ""}
                icon={STEP_ICONS[guide.step]}
                progress={guide.step !== "field" && guide.step !== "done" ? tx(locale, `step ${guide.steps.indexOf(guide.step) + 1} of ${guide.steps.length}`, `шаг ${guide.steps.indexOf(guide.step) + 1} из ${guide.steps.length}`) : undefined}
                items={suggestions}
                selected={Math.min(selectedSuggestion, suggestions.length - 1)}
                onHover={setSelectedSuggestion}
                onPick={(index) => acceptSuggestion(suggestions[index])}
                labels={{ navigate: tx(locale, "move", "выбор"), pick: tx(locale, "pick", "вставить"), close: tx(locale, "close", "закрыть") }}
              />
            ) : null}
            {calendarAt ? (
              <div
                data-suggest-menu
                ref={(node) => {
                  // Lift the calendar when it would run past the bottom of the window.
                  if (!node) return;
                  const overflow = node.getBoundingClientRect().bottom - (window.innerHeight - 12);
                  if (overflow > 0) node.style.top = `${node.offsetTop - overflow}px`;
                }}
                style={calendarAt}
                onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeCalendar(); } }}
                className="suggest-in absolute z-30 overflow-hidden rounded-xl border border-white/10 bg-[#18181c]/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
              >
                <DateCalendar
                  locale={locale}
                  showClear={false}
                  selected={(() => {
                    const typed = DATE_WORD.test(caretWord) ? parseDate(caretWord) : null;
                    return typed ? new Date(`${typed}T00:00:00`) : undefined;
                  })()}
                  onSelect={pickCalendarDate}
                />
              </div>
            ) : null}
          </div>

          {/* Guided steps */}
          {payload && !readOnly ? (
            <div className="space-y-3 border-t border-white/[0.06] px-7 py-4">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {guide.steps.map((step, index) => {
                  const active = guide.step === step;
                  const complete = guide.done.has(step);
                  return (
                    <span key={step} className="flex items-center gap-1.5">
                      {index ? <span className="h-px w-3 bg-white/10" /> : null}
                      <span className={cn(
                        "rounded-full px-2 py-0.5 transition",
                        active ? "bg-white/10 text-zinc-100" : complete ? "text-zinc-400" : "text-zinc-600",
                      )}>
                        {complete && !active ? "✓ " : ""}{STEP_LABELS[step][ru ? 1 : 0]}
                      </span>
                    </span>
                  );
                })}
                {guide.step !== "done" && guide.step !== "field" && currentLine ? (
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); skipStep(); }} className="ml-auto flex items-center gap-1 text-zinc-500 transition hover:text-zinc-300">
                    {tx(locale, "skip", "пропустить")} <Kbd>Esc</Kbd>
                  </button>
                ) : null}
              </div>
              {guide.question && !showSuggestions ? <p className="text-sm text-zinc-300">{guide.question}</p> : null}
              {guide.step === "done" && fieldHints.length > 0 && !showSuggestions ? (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <span>{tx(locale, "Optional fields:", "Доп. поля:")}</span>
                  {fieldHints.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onMouseDown={(event) => { event.preventDefault(); insertAtCaret(`/${slugify(field.label) || field.id}: `); }}
                      className="rounded-md border border-white/[0.08] px-2 py-0.5 font-mono text-[11px] text-zinc-300 transition hover:bg-white/[0.06]"
                    >
                      /{slugify(field.label) || field.id}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Body: cards or onboarding */}
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/[0.06]">
            {loading && !payload ? (
              <div className="flex items-center gap-2 px-7 py-6 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />{tx(locale, "Loading workspace…", "Загрузка…")}</div>
            ) : null}

            {aiState ? (
              <div className="mx-7 mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <p className="flex-1 text-sm text-zinc-200">{aiState.summary || tx(locale, "AI rewrote your text as capture lines.", "AI переписал текст в строки ввода.")}</p>
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

            {aiError ? <p className="mx-7 mt-6 text-sm text-red-300">{aiError}</p> : null}
            {notice ? <p className="mx-7 mt-6 text-xs text-zinc-400">{notice}</p> : null}

            {(aiHint || (parsed.some((line) => line.tokens.length > 8 && line.tokens.every((token) => token.kind === "name")))) && !aiState && hasText ? (
              <button
                type="button"
                onClick={sendToAi}
                disabled={isThinking}
                className="mx-7 mt-6 flex w-[calc(100%-3.5rem)] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-zinc-300"><Wand2 className="h-4 w-4" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-zinc-100">{tx(locale, "This looks like free text. Let AI sort it into entries?", "Похоже на свободный текст. Разобрать с помощью AI?")}</span>
                  <span className="block text-xs text-zinc-400">
                    {payload?.aiAvailable
                      ? tx(locale, "IPs, domains, logins and names are masked before anything is sent.", "IP, домены, логины и названия маскируются перед отправкой.")
                      : tx(locale, "AI needs Premium and an API key (Admin → AI import).", "Нужен Premium и ключ API (Админ → AI-импорт).")}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </button>
            ) : null}

            {isThinking ? (
              <div className="space-y-4 px-7 py-6">
                {[0, 1].map((key) => <div key={key} className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />)}
              </div>
            ) : parsed.length ? (
              <div className="space-y-4 px-7 py-6">
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
            ) : payload ? (
              <Onboarding locale={locale} onFile={() => fileRef.current?.click()} />
            ) : null}
          </div>
          </>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-7 py-5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {mode === "ai" ? (
                <span>{tx(locale, "AI turns the text into capture lines you can check before saving.", "AI превратит текст в строки, которые можно проверить перед сохранением.")}</span>
              ) : parsed.length ? (
                <>
                  {counts.create ? <span className="text-zinc-300">{tx(locale, `${counts.create} new`, `${counts.create} новых`)}</span> : null}
                  {counts.edit ? <span className="text-orange-200">{tx(locale, `${counts.edit} update`, `${counts.edit} изм.`)}</span> : null}
                  {counts.pay ? <span className="text-emerald-200">{tx(locale, `${counts.pay} payment`, `${counts.pay} оплат`)}</span> : null}
                  {totals.length ? (
                    <span className="text-zinc-300">+{totals.map(([currency, value]) => formatMoney(value, currency)).join(" + ")} {tx(locale, "/ month", "/ мес")}</span>
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
            {mode === "quick" && payload?.aiAvailable && aiState ? (
              <button type="button" onClick={() => runAi(aiState.answers)} disabled={isThinking} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50">
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {tx(locale, "Ask again", "Ещё раз")}
              </button>
            ) : null}
            <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-zinc-600 md:flex">
              <Kbd>Ctrl</Kbd><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd>
              {mode === "ai" ? tx(locale, "parse", "разобрать") : tx(locale, "save", "сохранить")}
            </span>
            {mode === "ai" ? (
              <button
                type="button"
                onClick={() => runAi({}, aiText)}
                disabled={!payload?.aiAvailable || !aiText.trim() || isThinking}
                className="btn-aurora inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {tx(locale, "Parse with AI", "Разобрать с AI")}
              </button>
            ) : (
            <button
              type="button"
              onClick={save}
              disabled={!parsed.length || isSaving || readOnly || isThinking}
              className="btn-aurora inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {parsed.length > 1 ? tx(locale, `Save ${parsed.length}`, `Сохранить ${parsed.length}`) : tx(locale, "Save", "Сохранить")}
            </button>
            )}
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

const AiImportPane = forwardRef<HTMLTextAreaElement, {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  noNotes: boolean;
  onNoNotesChange: (value: boolean) => void;
  aiAvailable: boolean;
  thinking: boolean;
  error: string;
}>(function AiImportPane({ locale, value, onChange, onKeyDown, noNotes, onNoNotesChange, aiAvailable, thinking, error }, ref) {
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <textarea
        ref={ref}
        autoFocus
        value={value}
        spellCheck={false}
        disabled={!aiAvailable || thinking}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={tx(
          locale,
          "Paste anything: an invoice, a list, a table.\nname: hz-fsn-01\nvendor: Hetzner\naccount: ops\nip: 95.217.10.4\nprice: 4.51 EUR/mo\nbilling start: 03.11.2026",
          "Вставьте что угодно: счёт, список, таблицу.\nname: hz-fsn-01\nvendor: Hetzner\naccount: ops\nip: 95.217.10.4\nprice: 4.51 EUR/mo\nbilling start: 03.11.2026",
        )}
        className="block min-h-[240px] w-full resize-none bg-transparent px-7 py-6 font-mono text-[14px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-60"
      />
      {thinking ? <div className="capture-shimmer pointer-events-none absolute inset-0" /> : null}
      <div className="space-y-2 border-t border-white/[0.06] px-7 py-4">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={noNotes} onChange={(event) => onNoNotesChange(event.target.checked)} className="h-4 w-4 accent-violet-500" />
          {tx(locale, "Don't add notes", "Не добавлять заметки")}
          <span className="text-xs text-zinc-500">{tx(locale, "AI fills fields only, never the notes", "AI заполняет только поля, без заметок")}</span>
        </label>
        <p className="text-xs text-zinc-500">
          {aiAvailable
            ? tx(locale, "Labels like name:, vendor:, account:, ip:, price: and billing start: (dd.mm.yyyy) are used as given. IPs, domains, logins and names are masked before anything is sent.", "Метки name:, vendor:, account:, ip:, price: и billing start: (дд.мм.гггг) используются как есть. IP, домены, логины и названия маскируются перед отправкой.")
            : tx(locale, "AI needs Premium and an API key (Admin → AI import).", "Нужен Premium и ключ API (Админ → AI-импорт).")}
        </p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
});

function Onboarding({ locale, onFile }: { locale: Locale; onFile: () => void }) {
  const legend: Array<{ kind: keyof typeof TOKEN_DOT; syntax: string; en: string; ru: string }> = [
    { kind: "category", syntax: "#servers", en: "category", ru: "категория" },
    { kind: "vendor", syntax: "@Hetzner", en: "vendor", ru: "поставщик" },
    { kind: "field", syntax: "account:ops", en: "account / login", ru: "аккаунт / логин" },
    { kind: "money", syntax: "€4.51/mo", en: "price & period", ru: "цена и период" },
    { kind: "date", syntax: "01.11.26", en: "billing start", ru: "начало оплаты" },
    { kind: "field", syntax: "/ip: 1.2.3.4", en: "category field", ru: "поле категории" },
    { kind: "notes", syntax: "// text", en: "notes", ru: "заметка" },
  ];
  return (
    <div className="space-y-4 px-7 py-5">
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
