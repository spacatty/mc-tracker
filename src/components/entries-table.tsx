"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  archiveItemAction,
  deleteItemAction,
  deleteItemsAction,
  exportSelectedEntriesAction,
  saveEntryBatchAction,
} from "@/app/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { entryStatus, type EntryStatus } from "@/lib/entry-status";
import type { Locale } from "@/lib/i18n";
import type {
  BillingPeriod,
  Category,
  CategoryField,
  EntryBatchRowError,
  EntryDraft,
  PaymentItem,
  VendorSuggestion,
} from "@/lib/types";
import { cn, displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { EntryCollection, statusLabel, type CollectionGroup, type CollectionLayout, type EntryView } from "./entry-collection";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DatePickerInput } from "./ui/date-picker";
import { Input, Textarea } from "./ui/input";
import { NativeSelect } from "./ui/native-select";

type SortKey = "name" | "category" | "vendor" | "created" | "date" | "amount" | "billing";
type Density = "compact" | "comfortable";
type DraftRow = EntryDraft & {
  amountInput: string;
  customPeriodDaysInput: string;
};
type FieldErrors = Record<string, string>;

const PERIODS: BillingPeriod[] = ["7d", "1m", "3m", "1y", "custom"];
const STATUS_DOTS: Record<EntryStatus, string> = {
  overdue: "bg-red-400",
  "due-soon": "bg-amber-400",
  active: "bg-emerald-400",
  ended: "bg-zinc-500",
  "no-date": "bg-zinc-600",
};

function tx(locale: Locale, en: string, ru: string) {
  return locale === "ru" ? ru : en;
}

function fuzzyMatch(value: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  let index = 0;
  const text = value.toLowerCase();
  for (const char of normalized) {
    index = text.indexOf(char, index);
    if (index === -1) return false;
    index += 1;
  }
  return true;
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function draftFromItem(item: PaymentItem): DraftRow {
  return {
    rowKey: `item-${item.id}`,
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    paymentType: item.paymentType,
    amount: item.amount,
    amountInput: String(item.amount),
    currency: item.currency,
    billingStartAt: dateInput(item.billingStartAt),
    billingEndAt: dateInput(item.billingEndAt),
    period: item.period,
    customPeriodDays: item.customPeriodDays,
    customPeriodDaysInput: item.customPeriodDays ? String(item.customPeriodDays) : "30",
    vendorName: item.vendorName,
    vendorUrl: item.vendorUrl,
    accountName: item.accountName,
    notes: item.notes,
    customFields: { ...item.customFields },
  };
}

function blankDraft(rowKey: string, categoryId?: number): DraftRow {
  return {
    rowKey,
    name: "",
    categoryId: categoryId || null,
    paymentType: "recurring",
    amount: 0,
    amountInput: "",
    currency: "USD",
    billingStartAt: "",
    billingEndAt: "",
    period: "1m",
    customPeriodDays: null,
    customPeriodDaysInput: "30",
    vendorName: "",
    vendorUrl: "",
    accountName: "",
    notes: "",
    customFields: {},
  };
}

function savableDraft(row: DraftRow): EntryDraft {
  const {
    amountInput,
    customPeriodDaysInput,
    ...draft
  } = row;
  return {
    ...draft,
    amount: Number(amountInput),
    customPeriodDays:
      draft.paymentType === "recurring" && draft.period === "custom"
        ? Number(customPeriodDaysInput)
        : null,
    period: draft.paymentType === "recurring" ? draft.period || "1m" : null,
  };
}

function comparable(row: DraftRow) {
  const draft = savableDraft(row);
  return JSON.stringify({
    ...draft,
    customFields: Object.fromEntries(
      Object.entries(draft.customFields || {}).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
}

function rowsFromItems(items: PaymentItem[], initialAdd: boolean, categoryId?: number) {
  const rows = items.map(draftFromItem);
  return initialAdd ? [blankDraft("new-initial", categoryId), ...rows] : rows;
}

function validUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateRow(row: DraftRow, categories: Category[], locale: Locale): FieldErrors {
  const errors: FieldErrors = {};
  const category = categories.find((candidate) => candidate.id === row.categoryId);
  const amount = Number(row.amountInput);
  const customDays = Number(row.customPeriodDaysInput);

  if (!row.name.trim()) errors.name = tx(locale, "Name is required.", "Укажите название.");
  if (!row.amountInput.trim() || !Number.isFinite(amount) || amount < 0) {
    errors.amount = tx(locale, "Enter a valid non-negative amount.", "Введите корректную сумму не меньше нуля.");
  }
  if (!SUPPORTED_CURRENCIES.some((currency) => currency.code === row.currency)) {
    errors.currency = tx(locale, "Choose a supported currency.", "Выберите поддерживаемую валюту.");
  }
  if (row.categoryId && !category) {
    errors.categoryId = tx(locale, "Choose a valid category.", "Выберите корректную категорию.");
  }
  if (row.paymentType === "recurring" && !row.period) {
    errors.period = tx(locale, "Choose a billing period.", "Выберите период оплаты.");
  }
  if (
    row.paymentType === "recurring" &&
    row.period === "custom" &&
    (!Number.isInteger(customDays) || customDays < 1)
  ) {
    errors.customPeriodDays = tx(locale, "Enter a positive whole number.", "Введите целое число больше нуля.");
  }
  if (row.billingStartAt && row.billingEndAt && row.billingEndAt < row.billingStartAt) {
    errors.billingEndAt = tx(locale, "End date cannot precede start date.", "Дата окончания не может быть раньше начала.");
  }
  if (!validUrl(row.vendorUrl || "")) {
    errors.vendorUrl = tx(locale, "Enter a valid http(s) URL.", "Введите корректный http(s) URL.");
  }

  category?.fields.forEach((field) => {
    const value = row.customFields?.[field.id];
    const key = `customFields.${field.id}`;
    if (field.required && (field.type === "checkbox" ? value !== true : String(value ?? "").trim() === "")) {
      errors[key] = tx(locale, `${field.label} is required.`, `Поле «${field.label}» обязательно.`);
    }
    if (field.type === "number" && String(value ?? "").trim() && !Number.isFinite(Number(value))) {
      errors[key] = tx(locale, "Enter a valid number.", "Введите корректное число.");
    }
    if (field.type === "url" && !validUrl(String(value ?? ""))) {
      errors[key] = tx(locale, "Enter a valid http(s) URL.", "Введите корректный http(s) URL.");
    }
  });
  return errors;
}

function valueFor(row: DraftRow, item: PaymentItem | undefined, key: SortKey, categories: Category[]) {
  if (key === "name") return row.name;
  if (key === "category") return categories.find((category) => category.id === row.categoryId)?.name || "";
  if (key === "vendor") return `${row.vendorName || ""} ${row.vendorUrl || ""} ${row.accountName || ""}`;
  if (key === "created") return item?.createdAt || "";
  if (key === "date") return row.billingEndAt || row.billingStartAt || "";
  if (key === "amount") return Number(row.amountInput) || 0;
  return row.period || row.paymentType;
}

function localizedPeriodLabel(period: BillingPeriod | null, customDays: number, locale: Locale) {
  if (locale === "ru") {
    if (period === "7d") return "7 дней";
    if (period === "1m") return "1 месяц";
    if (period === "3m") return "3 месяца";
    if (period === "1y") return "1 год";
    if (period === "custom") return `${customDays} дней`;
  }
  return periodLabel(period, customDays);
}

function shortBillingLabel(row: DraftRow, locale: Locale) {
  if (row.paymentType !== "recurring") return tx(locale, "Single", "Разовый");
  return localizedPeriodLabel(row.period || null, Number(row.customPeriodDaysInput) || 30, locale);
}

function entryDateLabel(value: string | null | undefined, locale: Locale) {
  return value ? displayDate(value) : tx(locale, "No date", "Нет даты");
}

function CellError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-[11px] leading-tight text-red-300">{message}</p> : null;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-muted-foreground">{children}</span>;
}

function CustomFieldEditor({
  field,
  value,
  onChange,
  error,
  locale,
}: {
  field: CategoryField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  locale: Locale;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  return (
    <label className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      {field.type === "checkbox" ? (
        <span className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface-muted px-3">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          <span className="text-sm text-foreground">{tx(locale, "Enabled", "Включено")}</span>
        </span>
      ) : field.type === "select" ? (
        <NativeSelect
          value={String(value ?? "")}
          onChange={onChange}
          ariaLabel={label}
          invalid={Boolean(error)}
        >
          <option value="">{tx(locale, "Select…", "Выберите…")}</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </NativeSelect>
      ) : field.type === "textarea" ? (
        <Textarea
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn("min-h-20", error && "border-red-400/70")}
        />
      ) : (
        <Input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn("h-9", error && "border-red-400/70")}
        />
      )}
      <CellError message={error} />
    </label>
  );
}

function SortButton({
  label,
  sortKey,
  active,
  direction,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  direction: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  return (
    <button type="button" onClick={() => onClick(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground">
      {label}
      <ArrowUpDown className={cn("h-3.5 w-3.5", active === sortKey ? "text-violet-300" : "text-subtle-foreground")} />
      {active === sortKey ? <span className="sr-only">{direction}</span> : null}
    </button>
  );
}

export function EntriesTable({
  items,
  categories,
  vendorSuggestions,
  workspaceId,
  workspaceRole,
  selectedCategoryId,
  initialAdd = false,
  locale = "en",
}: {
  items: PaymentItem[];
  categories: Category[];
  vendorSuggestions: VendorSuggestion[];
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  selectedCategoryId?: number;
  initialAdd?: boolean;
  locale?: Locale;
}) {
  const router = useRouter();
  const readOnly = workspaceRole === "viewer";
  const safeInitialAdd = initialAdd && !readOnly;
  const initialRows = useMemo(
    () => rowsFromItems(items, safeInitialAdd, selectedCategoryId),
    [items, safeInitialAdd, selectedCategoryId],
  );
  const [rows, setRows] = useState<DraftRow[]>(initialRows);
  const [baseline, setBaseline] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => {
      const row = draftFromItem(item);
      return [row.rowKey, comparable(row)];
    })),
  );
  const [editMode, setEditMode] = useState(safeInitialAdd);
  const [density, setDensity] = useState<Density>("compact");
  const [expanded, setExpanded] = useState<Set<string>>(() => safeInitialAdd ? new Set(["new-initial"]) : new Set());
  const [query, setQuery] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EntryStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [billingFilter, setBillingFilter] = useState<"all" | "recurring" | "single">("all");
  const [layout, setLayout] = useState<CollectionLayout>("cards");
  const [group, setGroup] = useState<CollectionGroup>(selectedCategoryId ? "status" : "category");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, FieldErrors>>({});
  const [serverErrors, setServerErrors] = useState<EntryBatchRowError[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isExportPending, startExportTransition] = useTransition();
  const rowCounter = useRef(items.length + 1);
  const saveLockedRef = useRef(false);
  const focusRowRef = useRef<string | null>(safeInitialAdd ? "new-initial" : null);
  const listHref = `/app/items?workspace=${workspaceId}${selectedCategoryId ? `&category=${selectedCategoryId}` : ""}`;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("mc-tracker-entries-view") || "{}") as { layout?: CollectionLayout; group?: CollectionGroup };
        if (saved.layout === "cards" || saved.layout === "list") setLayout(saved.layout);
        if (saved.group && ["none", "category", "status", "vendor", "account"].includes(saved.group)) setGroup(saved.group);
      } catch {
        // Ignore unreadable preferences.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function saveViewPreference(next: { layout?: CollectionLayout; group?: CollectionGroup }) {
    if (next.layout) setLayout(next.layout);
    if (next.group) setGroup(next.group);
    try {
      localStorage.setItem("mc-tracker-entries-view", JSON.stringify({ layout: next.layout || layout, group: next.group || group }));
    } catch {
      // Storage can be unavailable (private mode); preferences just won't persist.
    }
  }

  const sourceById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const baselineFromItems = useMemo(
    () => Object.fromEntries(items.map((item) => {
      const row = draftFromItem(item);
      return [row.rowKey, comparable(row)];
    })),
    [items],
  );

  const visibleFields = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId)?.fields.filter((field) => field.showInTable) || [],
    [categories, selectedCategoryId],
  );
  const showCategory = !selectedCategoryId;
  const dirtyRows = useMemo(
    () => rows.filter((row) => !row.id || baseline[row.rowKey] !== comparable(row)),
    [baseline, rows],
  );
  const dirtyKeys = useMemo(() => new Set(dirtyRows.map((row) => row.rowKey)), [dirtyRows]);
  const serverErrorMap = useMemo(
    () => Object.fromEntries(serverErrors.map((error) => [`${error.rowKey}:${error.field}`, error.message])),
    [serverErrors],
  );
  const rowHasError = (rowKey: string) =>
    Boolean(Object.keys(clientErrors[rowKey] || {}).length || serverErrors.some((error) => error.rowKey === rowKey));

  const filtered = useMemo(
    () => rows
      .filter((row) => {
        const category = categories.find((candidate) => candidate.id === row.categoryId);
        const searchable = `${row.name} ${row.vendorName || ""} ${row.vendorUrl || ""} ${row.accountName || ""} ${category?.name || ""} ${Object.values(row.customFields || {}).join(" ")}`;
        return fuzzyMatch(searchable, query);
      })
      .filter((row) => fuzzyMatch(row.name, nameFilter))
      .filter((row) => fuzzyMatch(row.accountName || "", accountFilter))
      .filter((row) => fuzzyMatch(`${row.vendorName || ""} ${row.vendorUrl || ""}`, vendorFilter))
      .filter((row) => editMode || categoryFilter === "all" || String(row.categoryId || "none") === categoryFilter)
      .filter((row) => editMode || billingFilter === "all" || row.paymentType === billingFilter)
      .filter((row) => editMode || statusFilter === "all" || entryStatus(row).status === statusFilter)
      .sort((a, b) => {
        if (!a.id && b.id) return -1;
        if (a.id && !b.id) return 1;
        if (!a.id && !b.id) return 0;
        const aValue = valueFor(a, a.id ? sourceById.get(a.id) : undefined, sortKey, categories);
        const bValue = valueFor(b, b.id ? sourceById.get(b.id) : undefined, sortKey, categories);
        const result = typeof aValue === "number" && typeof bValue === "number"
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
        return direction === "asc" ? result : -result;
      }),
    [accountFilter, billingFilter, categories, categoryFilter, direction, editMode, nameFilter, query, rows, sortKey, sourceById, statusFilter, vendorFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedIds = paged.flatMap((row) => row.id ? [row.id] : []);
  const selectedOnPage = pagedIds.filter((id) => selectedIds.has(id)).length;
  const pageSelectState = pagedIds.length && selectedOnPage === pagedIds.length
    ? true
    : selectedOnPage > 0
      ? "indeterminate"
      : false;
  const activeFilterCount = [nameFilter, accountFilter, vendorFilter].filter((value) => value.trim()).length
    + (categoryFilter !== "all" ? 1 : 0) + (billingFilter !== "all" ? 1 : 0);
  const statusCounts = useMemo(() => {
    const counts: Record<EntryStatus, number> = { overdue: 0, "due-soon": 0, active: 0, ended: 0, "no-date": 0 };
    rows.forEach((row) => { if (row.id) counts[entryStatus(row).status] += 1; });
    return counts;
  }, [rows]);
  const collectionEntries: EntryView[] = filtered.flatMap((row) => row.id ? [{
    id: row.id,
    name: row.name,
    categoryId: row.categoryId ?? null,
    paymentType: row.paymentType,
    amount: Number(row.amountInput) || 0,
    currency: row.currency,
    period: row.period ?? null,
    customPeriodDays: Number(row.customPeriodDaysInput) || null,
    billingStartAt: row.billingStartAt || null,
    billingEndAt: row.billingEndAt || null,
    vendorName: row.vendorName || "",
    vendorUrl: row.vendorUrl || "",
    accountName: row.accountName || "",
    notes: row.notes || "",
    customFields: row.customFields || {},
  }] : []);
  const vendorOptions = [...new Set(rows.map((row) => row.vendorName?.trim()).filter((value): value is string => Boolean(value)))].sort();
  const accountOptions = [...new Set(rows.map((row) => row.accountName?.trim()).filter((value): value is string => Boolean(value)))].sort();

  function clearFilters() {
    setNameFilter("");
    setAccountFilter("");
    setVendorFilter("");
    setCategoryFilter("all");
    setBillingFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  function editInGrid(id: number) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || readOnly) return;
    clearFilters();
    setQuery(row.name);
    setEditMode(true);
    setExpanded((current) => new Set(current).add(row.rowKey));
  }

  function fieldError(rowKey: string, field: string) {
    return clientErrors[rowKey]?.[field] || serverErrorMap[`${rowKey}:${field}`];
  }

  function updateRow(rowKey: string, patch: Partial<DraftRow>) {
    if (saveLockedRef.current) return;
    setRows((current) => current.map((row) => row.rowKey === rowKey ? { ...row, ...patch } : row));
    setClientErrors((current) => {
      if (!current[rowKey]) return current;
      const next = { ...current };
      delete next[rowKey];
      return next;
    });
    setServerErrors((current) => current.filter((error) => error.rowKey !== rowKey));
    setSaveMessage("");
  }

  function updateCustomField(row: DraftRow, fieldId: string, value: unknown) {
    updateRow(row.rowKey, { customFields: { ...(row.customFields || {}), [fieldId]: value } });
  }

  function changeSort(key: SortKey) {
    if (sortKey === key) setDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDirection(key === "amount" || key === "created" ? "desc" : "asc");
    }
  }

  function toggleExpanded(rowKey: string) {
    if (saveLockedRef.current) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  function focusRequestedRow(node: HTMLInputElement | null, rowKey: string) {
    if (!node || focusRowRef.current !== rowKey) return;
    requestAnimationFrame(() => {
      if (focusRowRef.current !== rowKey || node.offsetParent === null) return;
      node.focus({ preventScroll: true });
      node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      focusRowRef.current = null;
    });
  }

  function addRow() {
    if (saveLockedRef.current) return;
    const rowKey = `new-${rowCounter.current++}`;
    focusRowRef.current = rowKey;
    setEditMode(true);
    setRows((current) => [blankDraft(rowKey, selectedCategoryId), ...current]);
    setExpanded((current) => new Set(current).add(rowKey));
    setQuery("");
    setNameFilter("");
    setAccountFilter("");
    setVendorFilter("");
    setPage(1);
  }

  function duplicateRow(row: DraftRow) {
    if (saveLockedRef.current) return;
    const rowKey = `new-${rowCounter.current++}`;
    focusRowRef.current = rowKey;
    const duplicate: DraftRow = {
      ...row,
      rowKey,
      id: undefined,
      name: row.name ? `${row.name} ${tx(locale, "copy", "копия")}` : "",
      customFields: { ...(row.customFields || {}) },
    };
    setEditMode(true);
    setRows((current) => [duplicate, ...current]);
    setExpanded((current) => new Set(current).add(rowKey));
    setQuery("");
    setNameFilter("");
    setAccountFilter("");
    setVendorFilter("");
    setPage(1);
  }

  function resetRow(row: DraftRow) {
    if (saveLockedRef.current) return;
    if (!row.id) {
      setRows((current) => current.filter((candidate) => candidate.rowKey !== row.rowKey));
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(row.rowKey);
        return next;
      });
      if (safeInitialAdd && row.rowKey === "new-initial") router.replace(listHref);
      return;
    }
    const item = sourceById.get(row.id);
    if (item) updateRow(row.rowKey, draftFromItem(item));
  }

  function discardAll() {
    if (saveLockedRef.current) return;
    setRows(items.map(draftFromItem));
    setBaseline(baselineFromItems);
    setClientErrors({});
    setServerErrors([]);
    setSaveMessage("");
    setExpanded(new Set());
    setEditMode(false);
    if (safeInitialAdd) router.replace(listHref);
  }

  function saveChanges() {
    if (!dirtyRows.length || readOnly || saveLockedRef.current) return;
    const errors = Object.fromEntries(
      dirtyRows
        .map((row) => [row.rowKey, validateRow(row, categories, locale)] as const)
        .filter(([, rowErrors]) => Object.keys(rowErrors).length),
    );
    setClientErrors(errors);
    setServerErrors([]);
    if (Object.keys(errors).length) {
      setSaveMessage(tx(locale, "Fix the highlighted fields before saving.", "Исправьте выделенные поля перед сохранением."));
      const firstError = dirtyRows.find((row) => errors[row.rowKey]);
      if (firstError) setExpanded((current) => new Set(current).add(firstError.rowKey));
      return;
    }

    setSaveMessage("");
    saveLockedRef.current = true;
    startTransition(async () => {
      try {
        const result = await saveEntryBatchAction({
          workspaceId,
          rows: dirtyRows.map(savableDraft),
        });
        if (!result.success) {
          setServerErrors(result.rowErrors);
          setSaveMessage(result.message || tx(locale, "Some rows could not be saved.", "Некоторые строки не удалось сохранить."));
          const firstError = result.rowErrors[0];
          if (firstError) setExpanded((current) => new Set(current).add(firstError.rowKey));
          return;
        }
        const savedIds = new Map(result.saved.map((saved) => [saved.rowKey, saved.itemId]));
        const nextRows = rows.map((row) => savedIds.has(row.rowKey) ? { ...row, id: savedIds.get(row.rowKey) } : row);
        const nextBaseline = Object.fromEntries(nextRows.map((row) => [row.rowKey, comparable(row)]));
        setRows(nextRows);
        setBaseline(nextBaseline);
        setClientErrors({});
        setServerErrors([]);
        setExpanded(new Set());
        setEditMode(false);
        setSaveMessage(tx(locale, "Changes saved.", "Изменения сохранены."));
        if (safeInitialAdd) router.replace(listHref);
        else router.refresh();
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : tx(locale, "Unable to save changes.", "Не удалось сохранить изменения."));
      } finally {
        saveLockedRef.current = false;
      }
    });
  }

  function runItemAction(action: (formData: FormData) => Promise<void>, id: number) {
    if (readOnly) return;
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("workspaceId", String(workspaceId));
    startTransition(async () => {
      await action(formData);
      setRows((current) => current.filter((row) => row.id !== id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  function toggleItem(id: number, checked: boolean | "indeterminate") {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean | "indeterminate") {
    setSelectedIds((current) => {
      const next = new Set(current);
      pagedIds.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  }

  function bulkDelete() {
    if (readOnly) return;
    const formData = new FormData();
    formData.set("workspaceId", String(workspaceId));
    selectedIds.forEach((id) => formData.append("ids", String(id)));
    startTransition(async () => {
      await deleteItemsAction(formData);
      setRows((current) => current.filter((row) => !row.id || !selectedIds.has(row.id)));
      setSelectedIds(new Set());
      setConfirmOpen(false);
      router.refresh();
    });
  }

  function bulkExport() {
    if (!selectedIds.size) return;
    startExportTransition(async () => {
      try {
        const json = await exportSelectedEntriesAction(workspaceId, [...selectedIds]);
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `entries-export-w${workspaceId}-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : tx(locale, "Export failed.", "Ошибка экспорта."));
      }
    });
  }

  function renderInspector(row: DraftRow) {
    const category = categories.find((candidate) => candidate.id === row.categoryId);
    const errors = clientErrors[row.rowKey] || {};
    if (!editMode) {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <FieldLabel>URL</FieldLabel>
            {row.vendorUrl ? (
              <a href={row.vendorUrl} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 break-all text-sm text-sky-300 hover:text-sky-200">
                {row.vendorUrl}<ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : <p className="mt-1 text-sm text-subtle-foreground">—</p>}
          </div>
          <div className="md:col-span-2">
            <FieldLabel>{tx(locale, "Notes", "Заметки")}</FieldLabel>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.notes?.replace(/<[^>]+>/g, "") || "—"}</p>
          </div>
          {category?.fields.map((field) => (
            <div key={field.id}>
              <FieldLabel>{field.label}</FieldLabel>
              <p className="mt-1 text-sm text-foreground">
                {field.type === "checkbox"
                  ? (row.customFields?.[field.id] ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет"))
                  : String(row.customFields?.[field.id] ?? "—")}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1.5">
          <FieldLabel>URL</FieldLabel>
          <Input
            type="url"
            value={row.vendorUrl || ""}
            onChange={(event) => updateRow(row.rowKey, { vendorUrl: event.target.value })}
            placeholder="https://…"
            className={cn("h-9", fieldError(row.rowKey, "vendorUrl") && "border-red-400/70")}
          />
          <CellError message={fieldError(row.rowKey, "vendorUrl")} />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <FieldLabel>{tx(locale, "Notes", "Заметки")}</FieldLabel>
          <Textarea
            value={row.notes || ""}
            onChange={(event) => updateRow(row.rowKey, { notes: event.target.value })}
            placeholder={tx(locale, "Private notes and context…", "Заметки и контекст…")}
            className="min-h-20"
          />
        </label>
        {category?.fields.map((field) => (
          <CustomFieldEditor
            key={field.id}
            field={field}
            value={row.customFields?.[field.id]}
            onChange={(value) => updateCustomField(row, field.id, value)}
            error={errors[`customFields.${field.id}`] || fieldError(row.rowKey, `customFields.${field.id}`)}
            locale={locale}
          />
        ))}
        {!category?.fields.length ? (
          <p className="text-sm text-subtle-foreground">{tx(locale, "This category has no custom fields.", "У этой категории нет дополнительных полей.")}</p>
        ) : null}
      </div>
    );
  }

  function renderEditFields(row: DraftRow, mobile = false) {
    const cellClass = mobile ? "space-y-1.5" : "";
    return [
        <label key="name" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Name", "Название")}</FieldLabel> : null}
          <Input
            ref={(node) => focusRequestedRow(node, row.rowKey)}
            value={row.name}
            onChange={(event) => updateRow(row.rowKey, { name: event.target.value })}
            placeholder={tx(locale, "Entry name", "Название записи")}
            aria-label={tx(locale, "Name", "Название")}
            className={cn("h-9 min-w-44", fieldError(row.rowKey, "name") && "border-red-400/70")}
          />
          <CellError message={fieldError(row.rowKey, "name")} />
        </label>,
        <label key="category" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Category", "Категория")}</FieldLabel> : null}
          <NativeSelect
            value={String(row.categoryId || "")}
            onChange={(value) => updateRow(row.rowKey, { categoryId: Number(value) || null, customFields: {} })}
            ariaLabel={tx(locale, "Category", "Категория")}
            invalid={Boolean(fieldError(row.rowKey, "categoryId"))}
            className="min-w-40"
          >
            <option value="">{tx(locale, "Uncategorized", "Без категории")}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </NativeSelect>
          <CellError message={fieldError(row.rowKey, "categoryId")} />
        </label>,
        <label key="type" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Payment type", "Тип платежа")}</FieldLabel> : null}
          <NativeSelect
            value={row.paymentType}
            onChange={(value) => updateRow(row.rowKey, { paymentType: value as DraftRow["paymentType"] })}
            ariaLabel={tx(locale, "Payment type", "Тип платежа")}
            className="min-w-32"
          >
            <option value="single">{tx(locale, "Single", "Разовый")}</option>
            <option value="recurring">{tx(locale, "Recurring", "Регулярный")}</option>
          </NativeSelect>
        </label>,
        <label key="amount" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Amount", "Сумма")}</FieldLabel> : null}
          <Input
            type="number"
            min="0"
            step="0.01"
            value={row.amountInput}
            onChange={(event) => updateRow(row.rowKey, { amountInput: event.target.value })}
            aria-label={tx(locale, "Amount", "Сумма")}
            className={cn("h-9 min-w-28", fieldError(row.rowKey, "amount") && "border-red-400/70")}
          />
          <CellError message={fieldError(row.rowKey, "amount")} />
        </label>,
        <label key="currency" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Currency", "Валюта")}</FieldLabel> : null}
          <NativeSelect
            value={row.currency}
            onChange={(value) => updateRow(row.rowKey, { currency: value })}
            ariaLabel={tx(locale, "Currency", "Валюта")}
            invalid={Boolean(fieldError(row.rowKey, "currency"))}
            className="min-w-24"
          >
            {SUPPORTED_CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}
          </NativeSelect>
          <CellError message={fieldError(row.rowKey, "currency")} />
        </label>,
        <label key="period" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Period", "Период")}</FieldLabel> : null}
          {row.paymentType === "recurring" ? (
            <div className="flex min-w-36 gap-1">
              <NativeSelect
                value={row.period || "1m"}
                onChange={(value) => updateRow(row.rowKey, { period: value as BillingPeriod })}
                ariaLabel={tx(locale, "Period", "Период")}
                invalid={Boolean(fieldError(row.rowKey, "period"))}
              >
                {PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {localizedPeriodLabel(period, Number(row.customPeriodDaysInput) || 30, locale)}
                  </option>
                ))}
              </NativeSelect>
              {row.period === "custom" ? (
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={row.customPeriodDaysInput}
                  onChange={(event) => updateRow(row.rowKey, { customPeriodDaysInput: event.target.value })}
                  aria-label={tx(locale, "Custom period days", "Дней в периоде")}
                  className={cn("h-9 w-20", fieldError(row.rowKey, "customPeriodDays") && "border-red-400/70")}
                />
              ) : null}
            </div>
          ) : <span className="block py-2 text-sm text-subtle-foreground">—</span>}
          <CellError message={fieldError(row.rowKey, "period") || fieldError(row.rowKey, "customPeriodDays")} />
        </label>,
        <div key="start" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Start date", "Дата начала")}</FieldLabel> : null}
          <DatePickerInput
            name={`entry_${row.rowKey}_billingStartAt`}
            value={dateInput(row.billingStartAt)}
            onChange={(value) => updateRow(row.rowKey, { billingStartAt: value })}
            ariaLabel={tx(locale, "Start date", "Дата начала")}
            placeholder={tx(locale, "Start date", "Дата начала")}
            locale={locale}
            triggerClassName="h-9 min-w-36 px-2"
          />
          <CellError message={fieldError(row.rowKey, "billingStartAt")} />
        </div>,
        <div key="end" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "End date", "Дата окончания")}</FieldLabel> : null}
          <DatePickerInput
            name={`entry_${row.rowKey}_billingEndAt`}
            value={dateInput(row.billingEndAt)}
            onChange={(value) => updateRow(row.rowKey, { billingEndAt: value })}
            ariaLabel={tx(locale, "End date", "Дата окончания")}
            placeholder={tx(locale, "End date", "Дата окончания")}
            locale={locale}
            invalid={Boolean(fieldError(row.rowKey, "billingEndAt"))}
            triggerClassName="h-9 min-w-36 px-2"
          />
          <CellError message={fieldError(row.rowKey, "billingEndAt")} />
        </div>,
        <label key="vendor" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Vendor", "Поставщик")}</FieldLabel> : null}
          <Input
            value={row.vendorName || ""}
            onChange={(event) => updateRow(row.rowKey, { vendorName: event.target.value })}
            list="entry-vendor-suggestions"
            aria-label={tx(locale, "Vendor", "Поставщик")}
            className="h-9 min-w-36"
          />
        </label>,
        <label key="account" className={cellClass}>
          {mobile ? <FieldLabel>{tx(locale, "Account", "Аккаунт")}</FieldLabel> : null}
          <Input
            value={row.accountName || ""}
            onChange={(event) => updateRow(row.rowKey, { accountName: event.target.value })}
            list="entry-account-suggestions"
            aria-label={tx(locale, "Account", "Аккаунт")}
            className="h-9 min-w-36"
          />
        </label>,
    ];
  }

  return (
    <fieldset
      disabled={isPending}
      aria-busy={isPending}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface"
    >
      <datalist id="entry-vendor-suggestions">
        {[...new Set(vendorSuggestions.map((suggestion) => suggestion.vendorName).filter(Boolean))].map((value) => <option key={value} value={value} />)}
      </datalist>
      <datalist id="entry-account-suggestions">
        {[...new Set(vendorSuggestions.map((suggestion) => suggestion.accountName).filter(Boolean))].map((value) => <option key={value} value={value} />)}
      </datalist>

      <div className="space-y-3 border-b border-border p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder={tx(locale, "Search entries…", "Поиск записей…")}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setFiltersOpen((current) => !current)}>
              <Filter className="h-4 w-4" />
              {tx(locale, "Filters", "Фильтры")}{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
            {!editMode ? (
              <>
                <NativeSelect value={group} onChange={(value) => saveViewPreference({ group: value as CollectionGroup })} ariaLabel={tx(locale, "Group by", "Группировать")} className="h-8 w-40">
                  <option value="none">{tx(locale, "No grouping", "Без группировки")}</option>
                  <option value="category">{tx(locale, "Group: category", "Группа: категория")}</option>
                  <option value="status">{tx(locale, "Group: status", "Группа: статус")}</option>
                  <option value="vendor">{tx(locale, "Group: vendor", "Группа: поставщик")}</option>
                  <option value="account">{tx(locale, "Group: account", "Группа: аккаунт")}</option>
                </NativeSelect>
                <NativeSelect value={`${sortKey}:${direction}`} onChange={(value) => { const [key, dir] = value.split(":"); setSortKey(key as SortKey); setDirection(dir as "asc" | "desc"); }} ariaLabel={tx(locale, "Sort", "Сортировка")} className="h-8 w-44">
                  <option value="date:asc">{tx(locale, "Renewal: soonest", "Продление: ближайшие")}</option>
                  <option value="amount:desc">{tx(locale, "Amount: highest", "Сумма: по убыванию")}</option>
                  <option value="name:asc">{tx(locale, "Name A–Z", "Название А–Я")}</option>
                  <option value="created:desc">{tx(locale, "Recently added", "Недавно добавленные")}</option>
                  <option value="vendor:asc">{tx(locale, "Vendor A–Z", "Поставщик А–Я")}</option>
                </NativeSelect>
                <div className="flex rounded-md border border-border bg-surface-muted p-0.5" role="group" aria-label={tx(locale, "Layout", "Вид")}>
                  {([["cards", LayoutGrid, tx(locale, "Cards", "Карточки")], ["list", List, tx(locale, "List", "Список")]] as const).map(([value, Icon, label]) => (
                    <button key={value} type="button" onClick={() => saveViewPreference({ layout: value })} aria-pressed={layout === value} title={label} className={cn("rounded-sm px-2 py-1", layout === value ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <Icon className="h-4 w-4" />
                      <span className="sr-only">{label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <div className={cn("flex rounded-md border border-border bg-surface-muted p-0.5", !editMode && "hidden")} aria-label={tx(locale, "Table density", "Плотность таблицы")}>
              {(["compact", "comfortable"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDensity(value)}
                  className={cn("rounded-sm px-2 py-1 text-xs", density === value ? "bg-surface-raised text-foreground" : "text-muted-foreground")}
                >
                  {value === "compact" ? tx(locale, "Compact", "Компактно") : tx(locale, "Comfortable", "Удобно")}
                </button>
              ))}
            </div>
            {!readOnly ? (
              <>
                {!editMode ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setEditMode(true)}>
                    <Edit3 className="h-4 w-4" />{tx(locale, "Edit", "Изменить")}
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" size="sm" onClick={addRow}>
                  <Plus className="h-4 w-4" />{tx(locale, "Add row", "Добавить строку")}
                </Button>
                {editMode ? (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={discardAll} disabled={isPending}>
                      <RotateCcw className="h-4 w-4" />{tx(locale, "Discard all", "Отменить всё")}
                    </Button>
                    <Button type="button" size="sm" onClick={saveChanges} disabled={isPending || !dirtyRows.length}>
                      <Save className="h-4 w-4" />
                      {isPending ? tx(locale, "Saving…", "Сохранение…") : tx(locale, `Save changes${dirtyRows.length ? ` (${dirtyRows.length})` : ""}`, `Сохранить${dirtyRows.length ? ` (${dirtyRows.length})` : ""}`)}
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <Badge variant="secondary">{tx(locale, "View only", "Только просмотр")}</Badge>
            )}
          </div>
        </div>
        {filtersOpen && !editMode ? (
          <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-2 lg:grid-cols-5">
            {!selectedCategoryId ? (
              <NativeSelect value={categoryFilter} onChange={(value) => setCategoryFilter(value)} ariaLabel={tx(locale, "Category", "Категория")}>
                <option value="all">{tx(locale, "All categories", "Все категории")}</option>
                <option value="none">{tx(locale, "Uncategorized", "Без категории")}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </NativeSelect>
            ) : null}
            <NativeSelect value={billingFilter} onChange={(value) => setBillingFilter(value as typeof billingFilter)} ariaLabel={tx(locale, "Billing", "Оплата")}>
              <option value="all">{tx(locale, "Recurring and one-time", "Регулярные и разовые")}</option>
              <option value="recurring">{tx(locale, "Recurring only", "Только регулярные")}</option>
              <option value="single">{tx(locale, "One-time only", "Только разовые")}</option>
            </NativeSelect>
            <NativeSelect value={vendorFilter} onChange={(value) => setVendorFilter(value)} ariaLabel={tx(locale, "Vendor", "Поставщик")}>
              <option value="">{tx(locale, "All vendors", "Все поставщики")}</option>
              {vendorOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </NativeSelect>
            <NativeSelect value={accountFilter} onChange={(value) => setAccountFilter(value)} ariaLabel={tx(locale, "Account", "Аккаунт")}>
              <option value="">{tx(locale, "All accounts", "Все аккаунты")}</option>
              {accountOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </NativeSelect>
            {activeFilterCount ? (
              <Button type="button" variant="ghost" size="sm" className="h-9" onClick={clearFilters}><X className="h-4 w-4" />{tx(locale, "Clear filters", "Сбросить фильтры")}</Button>
            ) : null}
          </div>
        ) : null}
        {!editMode && rows.some((row) => row.id) ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx(locale, "Status", "Статус")}>
            {(["all", "overdue", "due-soon", "active", "ended", "no-date"] as const).filter((value) => value === "all" || statusCounts[value]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={statusFilter === value}
                onClick={() => setStatusFilter(statusFilter === value ? "all" : value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  statusFilter === value ? "border-violet-400/50 bg-violet-500/15 text-foreground" : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {value !== "all" ? <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[value])} /> : null}
                {value === "all" ? tx(locale, "All", "Все") : statusLabel(value, locale)}
                <span className="text-subtle-foreground">{value === "all" ? rows.filter((row) => row.id).length : statusCounts[value]}</span>
              </button>
            ))}
          </div>
        ) : null}
        {filtersOpen && editMode ? (
          <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3 md:grid-cols-3">
            <Input value={nameFilter} onChange={(event) => { setNameFilter(event.target.value); setPage(1); }} placeholder={tx(locale, "Filter by name…", "Фильтр по названию…")} />
            <Input value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPage(1); }} placeholder={tx(locale, "Filter by account…", "Фильтр по аккаунту…")} />
            <div className="flex gap-2">
              <Input value={vendorFilter} onChange={(event) => { setVendorFilter(event.target.value); setPage(1); }} placeholder={tx(locale, "Filter by vendor or URL…", "Фильтр по поставщику или URL…")} />
              {activeFilterCount ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => { setNameFilter(""); setAccountFilter(""); setVendorFilter(""); setPage(1); }} aria-label={tx(locale, "Clear filters", "Очистить фильтры")}>
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {saveMessage ? (
          <p className={cn("text-sm", Object.keys(clientErrors).length || serverErrors.length ? "text-red-300" : "text-muted-foreground")}>
            {saveMessage}
          </p>
        ) : null}
      </div>

      {!editMode ? (
        <div className="min-h-[320px] bg-surface-muted/40 p-4">
          {collectionEntries.length ? (
            <EntryCollection
              key={`${group}:${layout}`}
              entries={collectionEntries}
              categories={categories}
              layout={layout}
              group={group}
              selectedIds={selectedIds}
              readOnly={readOnly}
              workspaceId={workspaceId}
              showCategory={showCategory}
              pending={isPending}
              locale={locale}
              onToggleSelect={(id, checked) => toggleItem(id, checked)}
              onDuplicate={(id) => { const row = rows.find((candidate) => candidate.id === id); if (row) duplicateRow(row); }}
              onArchive={(id) => runItemAction(archiveItemAction, id)}
              onDelete={(id) => runItemAction(deleteItemAction, id)}
              onEditInGrid={editInGrid}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {rows.some((row) => row.id) ? tx(locale, "No entries match these filters.", "Нет записей по этим фильтрам.") : tx(locale, "No entries yet.", "Записей пока нет.")}
              </p>
              {rows.some((row) => row.id) ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => { clearFilters(); setQuery(""); }}>{tx(locale, "Clear filters", "Сбросить фильтры")}</Button>
              ) : !readOnly ? (
                <Button asChild size="sm"><Link href={`/app/import?workspace=${workspaceId}${selectedCategoryId ? `&category=${selectedCategoryId}` : ""}`}>{tx(locale, "Import entries", "Импортировать записи")}</Link></Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {editMode ? (<>
      <div className="relative isolate hidden max-h-[calc(100vh-285px)] min-h-[420px] overflow-auto md:block">
        <table className={cn("w-full border-collapse text-sm", editMode ? "min-w-[1780px]" : "min-w-[1120px]")}>
          <thead className="sticky top-0 z-30 bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="sticky left-0 z-40 w-14 min-w-14 bg-surface-muted px-2 py-3 text-left">
                <div className="flex h-7 items-center gap-1.5">
                  <Checkbox
                    checked={pageSelectState}
                    onCheckedChange={togglePage}
                    disabled={!pagedIds.length || readOnly || editMode}
                    aria-label={tx(locale, "Select page", "Выбрать страницу")}
                    className="h-3.5 w-3.5 rounded-[4px] [&_svg]:h-2.5 [&_svg]:w-2.5"
                  />
                </div>
              </th>
              <th className="sticky left-14 z-40 min-w-56 bg-surface-muted px-3 py-3 text-left"><SortButton label={tx(locale, "Name", "Название")} sortKey="name" active={sortKey} direction={direction} onClick={changeSort} /></th>
              {editMode ? (
                <>
                  <th className="min-w-44 px-3 py-3 text-left"><SortButton label={tx(locale, "Category", "Категория")} sortKey="category" active={sortKey} direction={direction} onClick={changeSort} /></th>
                  <th className="min-w-36 px-3 py-3 text-left">{tx(locale, "Type", "Тип")}</th>
                  <th className="min-w-28 px-3 py-3 text-left"><SortButton label={tx(locale, "Amount", "Сумма")} sortKey="amount" active={sortKey} direction={direction} onClick={changeSort} /></th>
                  <th className="min-w-24 px-3 py-3 text-left">{tx(locale, "Currency", "Валюта")}</th>
                  <th className="min-w-40 px-3 py-3 text-left"><SortButton label={tx(locale, "Period", "Период")} sortKey="billing" active={sortKey} direction={direction} onClick={changeSort} /></th>
                  <th className="min-w-40 px-3 py-3 text-left">{tx(locale, "Start", "Начало")}</th>
                  <th className="min-w-40 px-3 py-3 text-left">{tx(locale, "End", "Окончание")}</th>
                  <th className="min-w-40 px-3 py-3 text-left">{tx(locale, "Vendor", "Поставщик")}</th>
                  <th className="min-w-40 px-3 py-3 text-left">{tx(locale, "Account", "Аккаунт")}</th>
                </>
              ) : (
                <>
                  {visibleFields.map((field) => <th key={field.id} className="px-3 py-3 text-left">{field.label}</th>)}
                  {showCategory ? <th className="px-3 py-3 text-left"><SortButton label={tx(locale, "Category", "Категория")} sortKey="category" active={sortKey} direction={direction} onClick={changeSort} /></th> : null}
                  <th className="px-3 py-3 text-left"><SortButton label={tx(locale, "Vendor / account", "Поставщик / аккаунт")} sortKey="vendor" active={sortKey} direction={direction} onClick={changeSort} /></th>
                  <th className="px-3 py-3 text-left"><SortButton label={tx(locale, "Dates", "Даты")} sortKey="date" active={sortKey} direction={direction} onClick={changeSort} /></th>
                  <th className="px-3 py-3 text-right"><SortButton label={tx(locale, "Amount", "Сумма")} sortKey="amount" active={sortKey} direction={direction} onClick={changeSort} /></th>
                  <th className="px-3 py-3 text-left"><SortButton label={tx(locale, "Billing", "Оплата")} sortKey="billing" active={sortKey} direction={direction} onClick={changeSort} /></th>
                </>
              )}
              <th className="sticky right-0 z-40 w-px whitespace-nowrap bg-surface-muted px-2 py-3 text-right">{tx(locale, "Actions", "Действия")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((row) => {
              const category = categories.find((candidate) => candidate.id === row.categoryId);
              const isExpanded = expanded.has(row.rowKey);
              const status = !row.id ? "new" : dirtyKeys.has(row.rowKey) ? "dirty" : rowHasError(row.rowKey) ? "error" : "";
              const columnCount = editMode ? 12 : 8 + visibleFields.length + (showCategory ? 1 : 0);
              return (
                <Fragment key={row.rowKey}>
                  <tr className={cn("group bg-surface hover:bg-surface-raised", rowHasError(row.rowKey) && "ring-1 ring-inset ring-red-500/25", density === "compact" ? "[&>td]:py-1.5" : "[&>td]:py-3")}>
                    <td className="sticky left-0 z-20 w-14 min-w-14 bg-surface px-2 group-hover:bg-surface-raised">
                      <div className="flex h-7 items-center gap-1.5">
                        {row.id ? (
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={(checked) => toggleItem(row.id!, checked)}
                            disabled={readOnly || editMode}
                            aria-label={`${tx(locale, "Select", "Выбрать")} ${row.name}`}
                            className="h-3.5 w-3.5 rounded-[4px] [&_svg]:h-2.5 [&_svg]:w-2.5"
                          />
                        ) : (
                          <CircleDot className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-muted-foreground"
                          onClick={() => toggleExpanded(row.rowKey)}
                          title={isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали")}
                          aria-label={isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали")}
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </td>
                    {editMode ? (
                      <>
                        <td className="sticky left-14 z-20 min-w-56 bg-surface px-3 group-hover:bg-surface-raised">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">{renderEditFields(row)[0]}</div>
                            {status ? <Badge variant={status === "error" ? "destructive" : "default"} className="mt-1 px-1.5 py-0.5">{status === "new" ? tx(locale, "New", "Новая") : status === "dirty" ? tx(locale, "Changed", "Изменена") : tx(locale, "Error", "Ошибка")}</Badge> : null}
                          </div>
                        </td>
                        {renderEditFields(row).slice(1).map((field, index) => <td key={index} className="px-3 align-top">{field}</td>)}
                      </>
                    ) : (
                      <>
                        <td className="sticky left-14 z-20 min-w-56 bg-surface px-3 group-hover:bg-surface-raised">
                          <p className="font-semibold text-foreground">{row.name}</p>
                          {row.notes ? <p className="mt-1 max-w-64 truncate text-xs text-subtle-foreground">{row.notes.replace(/<[^>]+>/g, "")}</p> : null}
                        </td>
                        {visibleFields.map((field) => <td key={field.id} className={cn("px-3 text-muted-foreground", field.bold && "font-semibold text-foreground")} style={{ color: field.color || undefined }}>{field.type === "checkbox" ? (row.customFields?.[field.id] ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет")) : String(row.customFields?.[field.id] ?? "—")}</td>)}
                        {showCategory ? <td className="px-3"><Badge variant="secondary" style={{ color: category?.color || undefined }}><AppIcon name={category?.icon} className="mr-1.5 h-3.5 w-3.5" />{category?.name || tx(locale, "Uncategorized", "Без категории")}</Badge></td> : null}
                        <td className="px-3 text-muted-foreground"><p className="font-medium text-foreground">{row.accountName || "—"}</p><p className="max-w-48 truncate text-xs">{row.vendorName || row.vendorUrl || ""}</p></td>
                        <td className="whitespace-nowrap px-3 text-muted-foreground"><span>{entryDateLabel(row.billingStartAt, locale)}</span><span className="mx-1 text-subtle-foreground">→</span><span>{entryDateLabel(row.billingEndAt, locale)}</span></td>
                        <td className="whitespace-nowrap px-3 text-right font-semibold text-foreground">{formatMoney(Number(row.amountInput), row.currency)}</td>
                        <td className="px-3"><Badge variant={row.paymentType === "recurring" ? "success" : "secondary"}>{shortBillingLabel(row, locale)}</Badge></td>
                      </>
                    )}
                    <td className="sticky right-0 z-20 w-px whitespace-nowrap bg-surface px-2 text-right group-hover:bg-surface-raised">
                      <div className="flex justify-end gap-0.5">
                        {!readOnly ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => duplicateRow(row)}
                            title={tx(locale, "Duplicate row", "Дублировать строку")}
                            aria-label={tx(locale, "Duplicate row", "Дублировать строку")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {editMode && dirtyKeys.has(row.rowKey) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => resetRow(row)}
                            title={row.id ? tx(locale, "Reset row", "Сбросить строку") : tx(locale, "Remove new row", "Удалить новую строку")}
                            aria-label={row.id ? tx(locale, "Reset row", "Сбросить строку") : tx(locale, "Remove new row", "Удалить новую строку")}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {!editMode && !readOnly && row.id ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={isPending}
                              onClick={() => runItemAction(archiveItemAction, row.id!)}
                              title={tx(locale, "Archive", "Архивировать")}
                              aria-label={tx(locale, "Archive", "Архивировать")}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-300"
                              disabled={isPending}
                              onClick={() => runItemAction(deleteItemAction, row.id!)}
                              title={tx(locale, "Delete", "Удалить")}
                              aria-label={tx(locale, "Delete", "Удалить")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? <tr><td colSpan={columnCount} className="bg-surface-muted px-5 py-4">{renderInspector(row)}</td></tr> : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="max-h-[calc(100vh-260px)] min-h-[420px] space-y-3 overflow-y-auto p-3 md:hidden">
        {paged.map((row) => {
          const category = categories.find((candidate) => candidate.id === row.categoryId);
          const isExpanded = expanded.has(row.rowKey);
          return (
            <article key={row.rowKey} className={cn("rounded-lg border border-border bg-surface-raised", rowHasError(row.rowKey) && "border-red-400/50")}>
              <div className="flex items-start justify-between gap-3 border-b border-border p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-foreground">{row.name || tx(locale, "Untitled row", "Строка без названия")}</h3>
                    {!row.id ? <Badge>{tx(locale, "New", "Новая")}</Badge> : dirtyKeys.has(row.rowKey) ? <Badge>{tx(locale, "Changed", "Изменена")}</Badge> : null}
                    {rowHasError(row.rowKey) ? <Badge variant="destructive">{tx(locale, "Error", "Ошибка")}</Badge> : null}
                  </div>
                  {!editMode ? <p className="mt-1 text-xs text-muted-foreground">{category?.name || tx(locale, "Uncategorized", "Без категории")} · {formatMoney(Number(row.amountInput), row.currency)}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => duplicateRow(row)}
                      title={tx(locale, "Duplicate row", "Дублировать строку")}
                      aria-label={tx(locale, "Duplicate row", "Дублировать строку")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleExpanded(row.rowKey)}
                    title={isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали")}
                    aria-label={isExpanded ? tx(locale, "Hide details", "Скрыть детали") : tx(locale, "Show details", "Показать детали")}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {editMode ? (
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  {renderEditFields(row, true)}
                  {dirtyKeys.has(row.rowKey) ? <Button type="button" variant="ghost" size="sm" className="sm:col-span-2" onClick={() => resetRow(row)}><RotateCcw className="h-4 w-4" />{row.id ? tx(locale, "Reset row", "Сбросить строку") : tx(locale, "Remove row", "Удалить строку")}</Button> : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 text-sm">
                  <div><FieldLabel>{tx(locale, "Type", "Тип")}</FieldLabel><p className="mt-1 text-foreground">{shortBillingLabel(row, locale)}</p></div>
                  <div><FieldLabel>{tx(locale, "Account", "Аккаунт")}</FieldLabel><p className="mt-1 text-foreground">{row.accountName || "—"}</p></div>
                  <div><FieldLabel>{tx(locale, "Vendor", "Поставщик")}</FieldLabel><p className="mt-1 text-foreground">{row.vendorName || "—"}</p></div>
                  <div><FieldLabel>{tx(locale, "Dates", "Даты")}</FieldLabel><p className="mt-1 text-foreground">{entryDateLabel(row.billingStartAt, locale)} → {entryDateLabel(row.billingEndAt, locale)}</p></div>
                </div>
              )}
              {isExpanded ? <div className="border-t border-border bg-surface-muted p-3">{renderInspector(row)}</div> : null}
              {!editMode && !readOnly && row.id ? (
                <div className="flex gap-2 border-t border-border p-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => runItemAction(archiveItemAction, row.id!)}><Archive className="h-4 w-4" />{tx(locale, "Archive", "Архив")}</Button>
                  <Button type="button" variant="ghost" size="sm" className="text-red-300" onClick={() => runItemAction(deleteItemAction, row.id!)}><Trash2 className="h-4 w-4" />{tx(locale, "Delete", "Удалить")}</Button>
                </div>
              ) : null}
            </article>
          );
        })}
        {!paged.length ? <p className="py-16 text-center text-sm text-subtle-foreground">{tx(locale, "No entries match.", "Подходящих записей нет.")}</p> : null}
      </div>
      </>) : null}

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          {selectedIds.size ? (
            <>
              <Badge variant="secondary">{tx(locale, `${selectedIds.size} selected`, `Выбрано: ${selectedIds.size}`)}</Badge>
              <Button type="button" variant="secondary" size="sm" onClick={bulkExport} disabled={isExportPending}>
                <Download className="h-4 w-4" />{isExportPending ? tx(locale, "Exporting…", "Экспорт…") : tx(locale, "Export", "Экспорт")}
              </Button>
              {!readOnly ? (
                <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <Dialog.Trigger asChild><Button type="button" variant="secondary" size="sm" className="text-red-300"><Trash2 className="h-4 w-4" />{tx(locale, "Delete", "Удалить")}</Button></Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-2xl">
                      <div className="flex gap-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-300"><AlertTriangle className="h-5 w-5" /></span>
                        <div><Dialog.Title className="font-semibold text-foreground">{tx(locale, "Delete selected entries?", "Удалить выбранные записи?")}</Dialog.Title><Dialog.Description className="mt-2 text-sm text-muted-foreground">{tx(locale, `This permanently deletes ${selectedIds.size} entries.`, `Будет безвозвратно удалено записей: ${selectedIds.size}.`)}</Dialog.Description></div>
                      </div>
                      <div className="mt-6 flex justify-end gap-2">
                        <Dialog.Close asChild><Button type="button" variant="secondary">{tx(locale, "Cancel", "Отмена")}</Button></Dialog.Close>
                        <Button type="button" variant="destructive" onClick={bulkDelete} disabled={isPending}>{tx(locale, "Delete", "Удалить")}</Button>
                      </div>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              ) : null}
            </>
          ) : <span className="text-xs text-subtle-foreground">{tx(locale, `${editMode ? filtered.length : collectionEntries.length} entries`, `Записей: ${editMode ? filtered.length : collectionEntries.length}`)}</span>}
        </div>
        <div className={cn("flex items-center gap-2 self-end", !editMode && "hidden")}>
          <NativeSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} ariaLabel={tx(locale, "Rows per page", "Строк на странице")} className="h-8 w-20">
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </NativeSelect>
          <Button type="button" variant="secondary" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Badge variant="secondary">{safePage}/{totalPages}</Badge>
          <Button type="button" variant="secondary" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </fieldset>
  );
}
