"use client";

import { useRouter } from "next/navigation";
import { Fragment, type MouseEvent as ReactMouseEvent, type ReactNode, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  ChevronRight,
  CircleDot,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  Inbox,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  SearchX,
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
import type { Locale } from "@/lib/i18n";
import { count, pluralRu } from "@/lib/i18n";
import type {
  BillingPeriod,
  Category,
  CategoryField,
  EntryBatchRowError,
  EntryDraft,
  PaymentItem,
  VendorSuggestion,
} from "@/lib/types";
import { QuickLoginDialog } from "./vault/quick-login";
import { cn, displayDate, formatMoney, periodLabel, softColor } from "@/lib/utils";
import { TableStyleSelect, arrangeColumns, useEntryColumns } from "./table-style";
import { CategoryMark, CopyHost, VendorAccount } from "./host-line";
import { itemHost } from "@/lib/item-host";

const HOST_FIELD = /^(ip|ipv4|ipv6|ip address|server ip|host|hostname|domain|domain name|домен)$/i;
import { AppIcon } from "./icons";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DatePickerInput } from "./ui/date-picker";
import { ConfirmDialog } from "./ui/dialog";
import { EmptyState } from "./ui/empty-state";
import { Field } from "./ui/field";
import { Input, SearchInput, Textarea } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { RowAction, RowActionMenu, RowActions, type RowActionMenuEntry } from "./ui/row-actions";
import {
  SelectionBar,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableToolbar,
} from "./ui/table";

type SortKey = "name" | "category" | "vendor" | "created" | "date" | "amount" | "billing";
type DraftRow = EntryDraft & {
  amountInput: string;
  customPeriodDaysInput: string;
};
type FieldErrors = Record<string, string>;

const PERIODS: BillingPeriod[] = ["7d", "1m", "3m", "1y", "custom"];

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
    errors.amount = tx(locale, "Enter a valid non-negative amount.", "Введите сумму — число не меньше нуля.");
  }
  if (!SUPPORTED_CURRENCIES.some((currency) => currency.code === row.currency)) {
    errors.currency = tx(locale, "Choose a supported currency.", "Выберите валюту из списка.");
  }
  if (row.categoryId && !category) {
    errors.categoryId = tx(locale, "Choose a valid category.", "Выберите категорию из списка.");
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
    errors.vendorUrl = tx(locale, "Enter a valid http(s) URL.", "Введите ссылку, начинающуюся с http:// или https://.");
  }

  category?.fields.forEach((field) => {
    const value = row.customFields?.[field.id];
    const key = `customFields.${field.id}`;
    if (field.required && (field.type === "checkbox" ? value !== true : String(value ?? "").trim() === "")) {
      errors[key] = tx(locale, `${field.label} is required.`, `Заполните поле «${field.label}».`);
    }
    if (field.type === "number" && String(value ?? "").trim() && !Number.isFinite(Number(value))) {
      errors[key] = tx(locale, "Enter a valid number.", "Введите число.");
    }
    if (field.type === "url" && !validUrl(String(value ?? ""))) {
      errors[key] = tx(locale, "Enter a valid http(s) URL.", "Введите ссылку, начинающуюся с http:// или https://.");
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
    if (period === "custom") return `${customDays} ${pluralRu(customDays, "день", "дня", "дней")}`;
  }
  return periodLabel(period, customDays);
}

function shortBillingLabel(row: DraftRow, locale: Locale) {
  if (row.paymentType !== "recurring") return tx(locale, "Single", "Разовый");
  return localizedPeriodLabel(row.period || null, Number(row.customPeriodDaysInput) || 30, locale);
}

function entryDateLabel(value: string | null | undefined, locale: Locale) {
  return value ? displayDate(value) : tx(locale, "No date", "Без даты");
}

function CellError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-[11px] leading-tight text-red-300">{message}</p> : null;
}

/** Form-label text for wrappers that are already `<label>` elements (inline table editors, mobile cards). */
function LabelText({ children }: { children: ReactNode }) {
  return <span className="block text-xs font-medium leading-4 text-zinc-400">{children}</span>;
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
  const id = useId();
  return (
    <Field label={field.label} required={field.required} htmlFor={id} error={error}>
      {field.type === "checkbox" ? (
        <span className="flex h-9 items-center gap-2.5">
          <Checkbox id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} />
          <label htmlFor={id} className="text-[13px] text-zinc-300">{tx(locale, "Enabled", "Включено")}</label>
        </span>
      ) : field.type === "select" ? (
        <NativeSelect
          id={id}
          value={String(value ?? "")}
          onChange={onChange}
          ariaLabel={field.label}
          invalid={Boolean(error)}
        >
          <option value="">{tx(locale, "Select…", "Выберите…")}</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </NativeSelect>
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn("min-h-20", error && "border-red-400/70")}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-red-400/70")}
        />
      )}
    </Field>
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
  activeEntryId = null,
  onOpenEntry,
  onAddEntry,
}: {
  items: PaymentItem[];
  categories: Category[];
  vendorSuggestions: VendorSuggestion[];
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  selectedCategoryId?: number;
  initialAdd?: boolean;
  locale?: Locale;
  activeEntryId?: number | null;
  onOpenEntry?: (id: number, visibleOrder: number[]) => void;
  onAddEntry?: () => void;
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
  const [expanded, setExpanded] = useState<Set<string>>(() => safeInitialAdd ? new Set(["new-initial"]) : new Set());
  const [query, setQuery] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [quickLogin, setQuickLogin] = useState<{ id: number; open: boolean } | null>(null);
  const nameFilterId = useId();
  const accountFilterId = useId();
  const vendorFilterId = useId();
  const [clientErrors, setClientErrors] = useState<Record<string, FieldErrors>>({});
  const [serverErrors, setServerErrors] = useState<EntryBatchRowError[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isExportPending, startExportTransition] = useTransition();
  const rowCounter = useRef(items.length + 1);
  const saveLockedRef = useRef(false);
  const focusRowRef = useRef<string | null>(safeInitialAdd ? "new-initial" : null);
  const listHref = `/app/items?workspace=${workspaceId}${selectedCategoryId ? `&category=${selectedCategoryId}` : ""}`;

  const sourceById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const baselineFromItems = useMemo(
    () => Object.fromEntries(items.map((item) => {
      const row = draftFromItem(item);
      return [row.rowKey, comparable(row)];
    })),
    [items],
  );

  const visibleFields = useMemo(
    // The IP / domain has its own column, so its field is not repeated.
    () => categories.find((category) => category.id === selectedCategoryId)?.fields.filter((field) => field.showInTable && !HOST_FIELD.test(field.label)) || [],
    [categories, selectedCategoryId],
  );
  // View-mode columns between Name and the actions: order and visibility come from the "Table" settings.
  const columnConfig = useEntryColumns();
  const columnOptions = useMemo(
    () => [
      { id: "identifier", label: tx(locale, "Identifier", "Идентификатор") },
      ...visibleFields.map((field) => ({ id: `field:${field.id}`, label: field.label })),
      ...(!selectedCategoryId ? [{ id: "category", label: tx(locale, "Category", "Категория") }] : []),
      { id: "vendor", label: tx(locale, "Vendor / account", "Поставщик / аккаунт") },
      { id: "billing", label: tx(locale, "Billing", "Период") },
      { id: "dates", label: tx(locale, "Dates", "Даты") },
      { id: "amount", label: tx(locale, "Amount", "Сумма") },
    ],
    [locale, selectedCategoryId, visibleFields],
  );
  const viewColumns = useMemo(
    () => arrangeColumns(columnOptions, columnConfig).filter((column) => column.visible).map((column) => column.id),
    [columnConfig, columnOptions],
  );
  const showCategory = viewColumns.includes("category");
  const showMark = !showCategory;
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
    [accountFilter, categories, direction, nameFilter, query, rows, sortKey, sourceById, vendorFilter],
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
  const activeFilterCount = [nameFilter, accountFilter, vendorFilter].filter((value) => value.trim()).length;
  const hasDrawer = Boolean(onOpenEntry);
  // The drawer shows an entry's details in view mode, so rows only expand while editing (or when there is no drawer).
  const canExpand = editMode || !hasDrawer;
  const visibleOrder = () => filtered.flatMap((candidate) => candidate.id ? [candidate.id] : []);
  const savedText = tx(locale, "Changes saved.", "Изменения сохранены.");
  const messageTone = saveMessage === savedText && !Object.keys(clientErrors).length && !serverErrors.length ? "success" : "danger";

  function clearFilters() {
    setNameFilter("");
    setAccountFilter("");
    setVendorFilter("");
    setPage(1);
  }

  function sortProps(key: SortKey) {
    return { sortable: true, sorted: sortKey === key ? direction : (false as const), onSort: () => changeSort(key) };
  }

  function openFromRow(event: ReactMouseEvent, row: DraftRow) {
    if (!onOpenEntry || editMode || !row.id) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, label, [role=checkbox]")) return;
    onOpenEntry(row.id, visibleOrder());
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
        setSaveMessage(savedText);
        if (safeInitialAdd) router.replace(listHref);
        else router.refresh();
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : tx(locale, "Unable to save changes.", "Не удалось сохранить изменения."));
      } finally {
        saveLockedRef.current = false;
      }
    });
  }

  function runItemAction(action: (formData: FormData) => Promise<void>, id: number, onDone?: () => void) {
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
      onDone?.();
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
        setSaveMessage(error instanceof Error ? error.message : tx(locale, "Export failed.", "Не удалось экспортировать."));
      }
    });
  }

  function renderInspector(row: DraftRow) {
    const category = categories.find((candidate) => candidate.id === row.categoryId);
    const errors = clientErrors[row.rowKey] || {};
    if (!editMode) {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <LabelText>URL</LabelText>
            {row.vendorUrl ? (
              <a href={row.vendorUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 break-all text-[13px] text-sky-300 hover:text-sky-200">
                {row.vendorUrl}<ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : <p className="text-[13px] text-zinc-600">—</p>}
          </div>
          <div className="space-y-1 md:col-span-2">
            <LabelText>{tx(locale, "Notes", "Заметки")}</LabelText>
            <p className="whitespace-pre-wrap text-[13px] text-zinc-400">{row.notes?.replace(/<[^>]+>/g, "") || "—"}</p>
          </div>
          {category?.fields.map((field) => (
            <div key={field.id} className="space-y-1">
              <LabelText>{field.label}</LabelText>
              <p className="text-[13px] text-zinc-200">
                {field.type === "checkbox"
                  ? (row.customFields?.[field.id] ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет"))
                  : String(row.customFields?.[field.id] ?? "—")}
              </p>
            </div>
          ))}
        </div>
      );
    }
    const urlId = `entry-${row.rowKey}-url`;
    const notesId = `entry-${row.rowKey}-notes`;
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="URL" htmlFor={urlId} error={fieldError(row.rowKey, "vendorUrl")}>
          <Input
            id={urlId}
            type="url"
            value={row.vendorUrl || ""}
            onChange={(event) => updateRow(row.rowKey, { vendorUrl: event.target.value })}
            placeholder="https://…"
            aria-invalid={Boolean(fieldError(row.rowKey, "vendorUrl"))}
            className={cn(fieldError(row.rowKey, "vendorUrl") && "border-red-400/70")}
          />
        </Field>
        <Field label={tx(locale, "Notes", "Заметки")} htmlFor={notesId} className="md:col-span-2">
          <Textarea
            id={notesId}
            value={row.notes || ""}
            onChange={(event) => updateRow(row.rowKey, { notes: event.target.value })}
            placeholder={tx(locale, "Private notes and context…", "Заметки и контекст…")}
            className="min-h-20"
          />
        </Field>
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
          <p className="self-end text-xs text-zinc-500">{tx(locale, "This category has no custom fields.", "У этой категории нет дополнительных полей.")}</p>
        ) : null}
      </div>
    );
  }

  function renderEditFields(row: DraftRow, mobile = false) {
    const cellClass = mobile ? "grid gap-1.5" : "block";
    const control = mobile ? "h-9" : "h-8 text-[13px]";
    const selectSize = mobile ? "md" : "sm";
    const invalid = (field: string) => fieldError(row.rowKey, field) && "border-red-400/70";
    return [
        <label key="name" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "Name", "Название")}</LabelText> : null}
          <Input
            ref={(node) => focusRequestedRow(node, row.rowKey)}
            value={row.name}
            onChange={(event) => updateRow(row.rowKey, { name: event.target.value })}
            placeholder={tx(locale, "Entry name", "Название записи")}
            aria-label={tx(locale, "Name", "Название")}
            aria-invalid={Boolean(fieldError(row.rowKey, "name"))}
            className={cn(control, "min-w-40", invalid("name"))}
          />
          <CellError message={fieldError(row.rowKey, "name")} />
        </label>,
        <label key="category" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "Category", "Категория")}</LabelText> : null}
          <NativeSelect
            size={selectSize}
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
          {mobile ? <LabelText>{tx(locale, "Payment type", "Тип платежа")}</LabelText> : null}
          <NativeSelect
            size={selectSize}
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
          {mobile ? <LabelText>{tx(locale, "Amount", "Сумма")}</LabelText> : null}
          <Input
            type="number"
            min="0"
            step="0.01"
            value={row.amountInput}
            onChange={(event) => updateRow(row.rowKey, { amountInput: event.target.value })}
            aria-label={tx(locale, "Amount", "Сумма")}
            aria-invalid={Boolean(fieldError(row.rowKey, "amount"))}
            className={cn(control, "min-w-28 tabular-nums", invalid("amount"))}
          />
          <CellError message={fieldError(row.rowKey, "amount")} />
        </label>,
        <label key="currency" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "Currency", "Валюта")}</LabelText> : null}
          <NativeSelect
            size={selectSize}
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
          {mobile ? <LabelText>{tx(locale, "Period", "Период")}</LabelText> : null}
          {row.paymentType === "recurring" ? (
            <div className="flex min-w-36 gap-1">
              <NativeSelect
                size={selectSize}
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
                  aria-invalid={Boolean(fieldError(row.rowKey, "customPeriodDays"))}
                  className={cn(control, "w-20 tabular-nums", invalid("customPeriodDays"))}
                />
              ) : null}
            </div>
          ) : <span className={cn("flex items-center text-[13px] text-zinc-600", control)}>—</span>}
          <CellError message={fieldError(row.rowKey, "period") || fieldError(row.rowKey, "customPeriodDays")} />
        </label>,
        <div key="start" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "Start date", "Дата начала")}</LabelText> : null}
          <DatePickerInput
            name={`entry_${row.rowKey}_billingStartAt`}
            value={dateInput(row.billingStartAt)}
            onChange={(value) => updateRow(row.rowKey, { billingStartAt: value })}
            ariaLabel={tx(locale, "Start date", "Дата начала")}
            placeholder={tx(locale, "Start date", "Дата начала")}
            locale={locale}
            triggerClassName={cn(control, "min-w-36 px-2")}
          />
          <CellError message={fieldError(row.rowKey, "billingStartAt")} />
        </div>,
        <div key="end" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "End date", "Дата окончания")}</LabelText> : null}
          <DatePickerInput
            name={`entry_${row.rowKey}_billingEndAt`}
            value={dateInput(row.billingEndAt)}
            onChange={(value) => updateRow(row.rowKey, { billingEndAt: value })}
            ariaLabel={tx(locale, "End date", "Дата окончания")}
            placeholder={tx(locale, "End date", "Дата окончания")}
            locale={locale}
            invalid={Boolean(fieldError(row.rowKey, "billingEndAt"))}
            triggerClassName={cn(control, "min-w-36 px-2")}
          />
          <CellError message={fieldError(row.rowKey, "billingEndAt")} />
        </div>,
        <label key="vendor" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "Vendor", "Поставщик")}</LabelText> : null}
          <Input
            value={row.vendorName || ""}
            onChange={(event) => updateRow(row.rowKey, { vendorName: event.target.value })}
            list="entry-vendor-suggestions"
            aria-label={tx(locale, "Vendor", "Поставщик")}
            className={cn(control, "min-w-36")}
          />
        </label>,
        <label key="account" className={cellClass}>
          {mobile ? <LabelText>{tx(locale, "Account", "Аккаунт")}</LabelText> : null}
          <Input
            value={row.accountName || ""}
            onChange={(event) => updateRow(row.rowKey, { accountName: event.target.value })}
            list="entry-account-suggestions"
            aria-label={tx(locale, "Account", "Аккаунт")}
            className={cn(control, "min-w-36")}
          />
        </label>,
    ];
  }

  function rowStatus(row: DraftRow) {
    if (rowHasError(row.rowKey)) return "error" as const;
    if (!row.id) return "new" as const;
    if (dirtyKeys.has(row.rowKey)) return "dirty" as const;
    return null;
  }

  function statusBadge(row: DraftRow, className?: string) {
    const status = rowStatus(row);
    if (!status) return null;
    return (
      <Badge variant="tint" tone={status === "error" ? "danger" : "accent"} className={className}>
        {status === "new" ? tx(locale, "New", "Новая") : status === "dirty" ? tx(locale, "Changed", "Изменена") : tx(locale, "Error", "Ошибка")}
      </Badge>
    );
  }

  function expandToggle(row: DraftRow, className?: string) {
    const isExpanded = expanded.has(row.rowKey);
    const label = isExpanded ? tx(locale, "Hide details", "Скрыть подробности") : tx(locale, "Show details", "Показать подробности");
    return (
      <RowAction
        label={label}
        aria-expanded={isExpanded}
        icon={<ChevronRight className={cn("transition-transform", isExpanded && "rotate-90")} />}
        onClick={() => toggleExpanded(row.rowKey)}
        className={cn("text-zinc-500", className)}
      />
    );
  }

  function renderViewHead(id: string) {
    if (id === "identifier") return <TableHead key={id} width="12.5rem">{tx(locale, "Identifier", "Идентификатор")}</TableHead>;
    if (id === "category") return <TableHead key={id} width="10rem" {...sortProps("category")}>{tx(locale, "Category", "Категория")}</TableHead>;
    if (id === "vendor") return <TableHead key={id} width="14rem" {...sortProps("vendor")}>{tx(locale, "Vendor / account", "Поставщик / аккаунт")}</TableHead>;
    if (id === "dates") return <TableHead key={id} width="14rem" align="center" {...sortProps("date")}>{tx(locale, "Dates", "Даты")}</TableHead>;
    if (id === "amount") return <TableHead key={id} width="7.5rem" align="right" {...sortProps("amount")}>{tx(locale, "Amount", "Сумма")}</TableHead>;
    if (id === "billing") return <TableHead key={id} width="8rem" align="center" {...sortProps("billing")}>{tx(locale, "Billing", "Период")}</TableHead>;
    const field = visibleFields.find((candidate) => `field:${candidate.id}` === id);
    return field ? <TableHead key={id}>{field.label}</TableHead> : null;
  }

  function renderViewCell(id: string, row: DraftRow, category: Category | undefined, host: string) {
    if (id === "identifier") {
      return <TableCell key={id}>{host ? <CopyHost value={host} locale={locale} className="mt-0 max-w-full" /> : <span className="text-zinc-700">—</span>}</TableCell>;
    }
    if (id === "category") {
      return (
        <TableCell key={id}>
          <Badge color={category?.color || undefined} icon={<AppIcon name={category?.icon} />}>
            {category?.name || tx(locale, "Uncategorized", "Без категории")}
          </Badge>
        </TableCell>
      );
    }
    if (id === "vendor") {
      return (
        <TableCell key={id}>
          <VendorAccount vendor={row.vendorName || row.vendorUrl} account={row.accountName} className="max-w-64" />
        </TableCell>
      );
    }
    if (id === "dates") {
      return (
        <TableCell key={id} align="center" className="whitespace-nowrap tabular-nums">
          <span className={row.billingStartAt ? undefined : "text-zinc-600"}>{entryDateLabel(row.billingStartAt, locale)}</span>
          <span className="mx-1.5 text-zinc-600">→</span>
          <span className={row.billingEndAt ? "text-zinc-300" : "text-zinc-600"}>{entryDateLabel(row.billingEndAt, locale)}</span>
        </TableCell>
      );
    }
    if (id === "amount") {
      return (
        <TableCell key={id} align="right" className="whitespace-nowrap font-semibold tabular-nums text-zinc-100">
          {formatMoney(Number(row.amountInput), row.currency)}
        </TableCell>
      );
    }
    if (id === "billing") {
      return (
        <TableCell key={id} align="center">
          <Badge tone={row.paymentType === "recurring" ? "success" : "default"}>{shortBillingLabel(row, locale)}</Badge>
        </TableCell>
      );
    }
    const field = visibleFields.find((candidate) => `field:${candidate.id}` === id);
    if (!field) return null;
    return (
      <TableCell key={id} className={cn(field.bold && "font-semibold text-zinc-100")} style={{ color: softColor(field.color) }}>
        {field.type === "checkbox" ? (row.customFields?.[field.id] ? tx(locale, "Yes", "Да") : tx(locale, "No", "Нет")) : String(row.customFields?.[field.id] ?? "—")}
      </TableCell>
    );
  }

  function renderActions(row: DraftRow, mobile = false) {
    const hasLogin = Boolean(row.id && (row.accountName || row.vendorName || row.vendorUrl));
    const menu: RowActionMenuEntry[] = editMode
      ? [
          !readOnly && { label: tx(locale, "Duplicate row", "Дублировать строку"), icon: <Copy />, onSelect: () => duplicateRow(row) },
          !!row.id && dirtyKeys.has(row.rowKey) && { label: tx(locale, "Reset row", "Сбросить строку"), icon: <RotateCcw />, onSelect: () => resetRow(row) },
          !row.id && "separator",
          !row.id && { label: tx(locale, "Remove new row", "Убрать новую строку"), icon: <Trash2 />, destructive: true, onSelect: () => resetRow(row) },
        ]
      : [
          !readOnly && { label: tx(locale, "Duplicate row", "Дублировать строку"), icon: <Copy />, onSelect: () => duplicateRow(row) },
          !readOnly && !!row.id && { label: tx(locale, "Archive", "В архив"), icon: <Archive />, disabled: isPending, onSelect: () => runItemAction(archiveItemAction, row.id!) },
          "separator",
          !readOnly && !!row.id && {
            label: tx(locale, "Delete", "Удалить"),
            icon: <Trash2 />,
            destructive: true,
            disabled: isPending,
            onSelect: () => setDeleteTarget({ id: row.id!, name: row.name }),
          },
        ];
    return (
      <RowActions className={mobile ? "justify-start" : undefined}>
        {!editMode && hasLogin ? (
          <RowAction
            label={tx(locale, "Quick login", "Быстрый вход")}
            icon={<KeyRound />}
            onClick={() => setQuickLogin({ id: row.id!, open: true })}
          />
        ) : !editMode && !mobile ? (
          <span className="inline-block h-7 w-7 shrink-0" aria-hidden="true" />
        ) : null}
        {!editMode && onOpenEntry && row.id ? (
          <RowAction
            label={`${tx(locale, "Edit", "Изменить")} ${row.name}`}
            icon={<Pencil />}
            onClick={() => onOpenEntry(row.id!, visibleOrder())}
          />
        ) : null}
        <RowActionMenu label={tx(locale, `More actions for ${row.name || "row"}`, `Другие действия: ${row.name || "строка"}`)} items={menu} />
      </RowActions>
    );
  }

  const emptyState = rows.length ? (
    {
      icon: <SearchX />,
      title: tx(locale, "No entries match.", "Ничего не найдено."),
      action: query || activeFilterCount ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => { setQuery(""); clearFilters(); }}>
          <X className="h-3.5 w-3.5" />{tx(locale, "Clear search and filters", "Сбросить поиск и фильтры")}
        </Button>
      ) : null,
    }
  ) : {
    icon: <Inbox />,
    title: tx(locale, "No entries yet", "Записей пока нет"),
    action: null,
  };

  return (
    <fieldset
      disabled={isPending}
      aria-busy={isPending}
      className="flex min-h-[26rem] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-surface"
    >
      <datalist id="entry-vendor-suggestions">
        {[...new Set(vendorSuggestions.map((suggestion) => suggestion.vendorName).filter(Boolean))].map((value) => <option key={value} value={value} />)}
      </datalist>
      <datalist id="entry-account-suggestions">
        {[...new Set(vendorSuggestions.map((suggestion) => suggestion.accountName).filter(Boolean))].map((value) => <option key={value} value={value} />)}
      </datalist>

      <TableToolbar
        end={
          <>
            {/* Always present so the toolbar never shifts; column choices are locked while editing. */}
            <TableStyleSelect locale={locale} columns={editMode ? undefined : columnOptions} />
            {!readOnly ? (
              <>
                {/* Edit and Add row share one frame: a single control instead of two boxes. */}
                <div className="flex h-8 items-stretch divide-x divide-white/[0.08] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  {/* Edit becomes Discard (red) while editing: leaves edit mode, asking first if there are changes. */}
                  <button
                    type="button"
                    aria-pressed={editMode}
                    onClick={() => (!editMode ? setEditMode(true) : dirtyRows.length ? setDiscardOpen(true) : discardAll())}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 text-xs font-medium transition focus-visible:bg-white/[0.06] focus-visible:outline-none",
                      editMode ? "bg-red-500/10 text-red-200 hover:bg-red-500/15 hover:text-red-100" : "text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50",
                    )}
                  >
                    {editMode ? (
                      <><RotateCcw className="h-3.5 w-3.5 text-red-300" />{tx(locale, "Discard", "Отменить")}</>
                    ) : (
                      <><Edit3 className="h-3.5 w-3.5 text-zinc-500" />{tx(locale, "Edit", "Изменить")}</>
                    )}
                  </button>
                  <button type="button" onClick={() => (onAddEntry && !editMode ? onAddEntry() : addRow())} className="inline-flex items-center gap-1.5 px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-zinc-50 focus-visible:bg-white/[0.06] focus-visible:outline-none">
                    <Plus className="h-3.5 w-3.5 text-zinc-500" />{tx(locale, "Add row", "Добавить строку")}
                  </button>
                </div>
                {editMode ? (
                  <div className="flex items-center gap-2 border-l border-white/[0.08] pl-2">
                    <Button type="button" size="sm" onClick={saveChanges} disabled={isPending || !dirtyRows.length}>
                      <Save className="h-3.5 w-3.5" />
                      {isPending ? tx(locale, "Saving…", "Сохранение…") : tx(locale, "Save changes", "Сохранить")}
                      {dirtyRows.length && !isPending ? <span className="rounded bg-white/10 px-1.5 text-[11px] tabular-nums leading-4 text-white/90">{dirtyRows.length}</span> : null}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <Badge variant="outline">{tx(locale, "View only", "Только просмотр")}</Badge>
            )}
          </>
        }
      >
        <SearchInput
          size="sm"
          value={query}
          onChange={(value) => { setQuery(value); setPage(1); }}
          placeholder={tx(locale, "Search entries…", "Поиск записей…")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="min-w-48 max-w-sm flex-1"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant={activeFilterCount ? "accent" : "secondary"} size="sm">
              <Filter className="h-3.5 w-3.5" />
              {tx(locale, "Filters", "Фильтры")}
              {activeFilterCount ? (
                <span className="tabular-nums text-violet-300" aria-label={tx(locale, `${activeFilterCount} active`, `Активно: ${activeFilterCount}`)}>
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="grid gap-3 p-4">
              <Field label={tx(locale, "Name", "Название")} htmlFor={nameFilterId}>
                <Input id={nameFilterId} value={nameFilter} onChange={(event) => { setNameFilter(event.target.value); setPage(1); }} placeholder={tx(locale, "Filter by name…", "Фильтр по названию…")} className="h-8 text-[13px]" />
              </Field>
              <Field label={tx(locale, "Account", "Аккаунт")} htmlFor={accountFilterId}>
                <Input id={accountFilterId} value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPage(1); }} placeholder={tx(locale, "Filter by account…", "Фильтр по аккаунту…")} className="h-8 text-[13px]" />
              </Field>
              <Field label={tx(locale, "Vendor or URL", "Поставщик или URL")} htmlFor={vendorFilterId}>
                <Input id={vendorFilterId} value={vendorFilter} onChange={(event) => { setVendorFilter(event.target.value); setPage(1); }} placeholder={tx(locale, "Filter by vendor or URL…", "Фильтр по поставщику или URL…")} className="h-8 text-[13px]" />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5">
              <span className="text-[11.5px] tabular-nums text-zinc-500">
                {tx(locale, `${activeFilterCount} active`, `Активно: ${activeFilterCount}`)}
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={clearFilters} disabled={!activeFilterCount} aria-label={tx(locale, "Clear filters", "Сбросить фильтры")}>
                <X className="h-3.5 w-3.5" />{tx(locale, "Clear", "Сбросить")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-xs tabular-nums text-zinc-500">{count(locale, filtered.length, { one: "entry", other: "entries", ru: ["запись", "записи", "записей"] })}</span>
      </TableToolbar>

      {saveMessage ? (
        <div className="border-b border-white/[0.06] px-4 py-3">
          <Alert tone={messageTone}>{saveMessage}</Alert>
        </div>
      ) : null}

      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <Table
          bare
          fill
          density={editMode ? "compact" : "default"}
          minWidth={editMode ? 1780 : 1120}
          containerClassName="isolate"
        >
          <TableHeader>
            <TableRow>
              <TableHead sticky="left" data-select="" className="w-12 min-w-12 max-w-12 pl-6 pr-2">
                <span className="flex items-center">
                  <Checkbox
                    checked={pageSelectState}
                    onCheckedChange={togglePage}
                    disabled={!pagedIds.length || readOnly || editMode}
                    aria-label={tx(locale, "Select page", "Выбрать все на странице")}
                  />
                </span>
              </TableHead>
              <TableHead sticky="left" className="left-12 min-w-56" {...sortProps("name")}>{tx(locale, "Name", "Название")}</TableHead>
              {editMode ? (
                <>
                  <TableHead className="min-w-44" {...sortProps("category")}>{tx(locale, "Category", "Категория")}</TableHead>
                  <TableHead className="min-w-36">{tx(locale, "Type", "Тип")}</TableHead>
                  <TableHead className="min-w-28" {...sortProps("amount")}>{tx(locale, "Amount", "Сумма")}</TableHead>
                  <TableHead className="min-w-24">{tx(locale, "Currency", "Валюта")}</TableHead>
                  <TableHead className="min-w-40" {...sortProps("billing")}>{tx(locale, "Period", "Период")}</TableHead>
                  <TableHead className="min-w-40">{tx(locale, "Start", "Начало")}</TableHead>
                  <TableHead className="min-w-40">{tx(locale, "End", "Окончание")}</TableHead>
                  <TableHead className="min-w-40">{tx(locale, "Vendor", "Поставщик")}</TableHead>
                  <TableHead className="min-w-40">{tx(locale, "Account", "Аккаунт")}</TableHead>
                </>
              ) : (
                <>
                  {viewColumns.map((id) => renderViewHead(id))}
                </>
              )}
              <TableHead sticky="right" align="right" width="1%">
                <span className="sr-only">{tx(locale, "Actions", "Действия")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => {
              const category = categories.find((candidate) => candidate.id === row.categoryId);
              const host = editMode ? "" : itemHost(row.customFields, category?.fields, category?.name, category?.identifierField);
              const isExpanded = canExpand && expanded.has(row.rowKey);
              const hasError = rowHasError(row.rowKey);
              const columnCount = editMode ? 12 : 3 + viewColumns.length;
              const editFields = editMode ? renderEditFields(row) : [];
              return (
                <Fragment key={row.rowKey}>
                  <TableRow
                    data-entry-row
                    interactive={Boolean(onOpenEntry && !editMode && row.id)}
                    active={Boolean(activeEntryId && row.id === activeEntryId)}
                    selected={Boolean(row.id && selectedIds.has(row.id))}
                    data-error={hasError ? "" : undefined}
                    onClick={(event) => openFromRow(event, row)}
                    className={cn(hasError && "[&>td:first-child]:shadow-[inset_2px_0_0_rgb(248_113_113/0.7)]")}
                  >
                    <TableCell
                      sticky="left"
                      data-select=""
                      className={cn("w-12 min-w-12 max-w-12 pl-6 pr-2", editMode && "align-top pt-[0.6rem]")}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className="flex h-4 items-center">
                        {row.id ? (
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={(checked) => toggleItem(row.id!, checked)}
                            disabled={readOnly || editMode}
                            aria-label={`${tx(locale, "Select", "Выбрать")} ${row.name}`}
                          />
                        ) : (
                          <span role="img" aria-label={tx(locale, "New row", "Новая строка")} className="grid h-4 w-4 place-items-center text-violet-300">
                            <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    </TableCell>
                    {editMode ? (
                      <>
                        <TableCell sticky="left" className="left-12 min-w-56 align-top">
                          <div className="flex items-start gap-1">
                            {expandToggle(row, "mt-0.5")}
                            <div className="min-w-0 flex-1">{editFields[0]}</div>
                            {statusBadge(row, "mt-1.5")}
                          </div>
                        </TableCell>
                        {editFields.slice(1).map((field, index) => <TableCell key={index} className="align-top">{field}</TableCell>)}
                      </>
                    ) : (
                      <>
                        <TableCell sticky="left" primary className="left-12 min-w-56">
                          <div className="flex items-center gap-1">
                            {canExpand ? expandToggle(row, "-ml-1.5") : null}
                            <div className="min-w-0 flex-1">
                              <p className="flex min-w-0 items-center gap-2">
                                {showMark ? <CategoryMark category={category} /> : null}
                                <span className="max-w-72 truncate">{row.name}</span>
                              </p>
                              {row.notes ? <p className="mt-0.5 max-w-64 truncate text-[11.5px] font-normal text-zinc-500">{row.notes.replace(/<[^>]+>/g, "")}</p> : null}
                            </div>
                          </div>
                        </TableCell>
                        {viewColumns.map((id) => renderViewCell(id, row, category, host))}
                      </>
                    )}
                    <TableCell sticky="right" align="right" className={cn("w-[1%] whitespace-nowrap", editMode && "align-top")}>
                      {renderActions(row)}
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <tr data-empty="">
                      <td colSpan={columnCount} className="border-t border-white/[0.04] bg-surface-muted px-5 py-4">
                        {renderInspector(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!paged.length ? (
              <TableEmpty
                colSpan={editMode ? 12 : 3 + viewColumns.length}
                icon={emptyState.icon}
                title={emptyState.title}
                action={emptyState.action}
              />
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 md:hidden">
        {paged.map((row) => {
          const category = categories.find((candidate) => candidate.id === row.categoryId);
          const isExpanded = canExpand && expanded.has(row.rowKey);
          const isActive = Boolean(activeEntryId && row.id === activeEntryId);
          const hasError = rowHasError(row.rowKey);
          return (
            <article
              key={row.rowKey}
              data-entry-row
              onClick={(event) => openFromRow(event, row)}
              className={cn(
                "group overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] transition",
                onOpenEntry && !editMode && row.id && "cursor-pointer hover:bg-white/[0.04]",
                isActive && "border-violet-400/40 bg-violet-500/[0.06]",
                hasError && "border-red-400/40",
              )}
            >
              <div className="flex items-start gap-2 px-3 py-2.5">
                {canExpand ? expandToggle(row, "-ml-1 shrink-0") : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[13px] font-medium text-zinc-100">{row.name || tx(locale, "Untitled row", "Строка без названия")}</h3>
                    {statusBadge(row)}
                  </div>
                  {!editMode && itemHost(row.customFields, category?.fields, category?.name, category?.identifierField) ? <CopyHost value={itemHost(row.customFields, category?.fields, category?.name, category?.identifierField)} locale={locale} /> : null}
                  {!editMode ? (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge color={category?.color || undefined} icon={<AppIcon name={category?.icon} />}>
                        {category?.name || tx(locale, "Uncategorized", "Без категории")}
                      </Badge>
                      <span className="text-xs text-zinc-500">{shortBillingLabel(row, locale)}</span>
                    </div>
                  ) : null}
                </div>
                {!editMode ? (
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-zinc-100">{formatMoney(Number(row.amountInput), row.currency)}</span>
                ) : null}
              </div>
              {editMode ? (
                <div className="grid gap-3 border-t border-white/[0.06] p-3 sm:grid-cols-2">
                  {renderEditFields(row, true)}
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] px-3 py-2.5 text-[13px]">
                  <div><dt className="text-[11.5px] text-zinc-500">{tx(locale, "Account", "Аккаунт")}</dt><dd className="mt-0.5 truncate text-zinc-300">{row.accountName || "—"}</dd></div>
                  <div><dt className="text-[11.5px] text-zinc-500">{tx(locale, "Vendor", "Поставщик")}</dt><dd className="mt-0.5 truncate text-zinc-300">{row.vendorName || "—"}</dd></div>
                  <div className="col-span-2"><dt className="text-[11.5px] text-zinc-500">{tx(locale, "Dates", "Даты")}</dt><dd className="mt-0.5 tabular-nums text-zinc-300">{entryDateLabel(row.billingStartAt, locale)} <span className="text-zinc-600">→</span> {entryDateLabel(row.billingEndAt, locale)}</dd></div>
                </dl>
              )}
              {isExpanded ? <div className="border-t border-white/[0.06] bg-surface-muted p-3">{renderInspector(row)}</div> : null}
              <div className="flex items-center gap-2 border-t border-white/[0.06] px-2 py-1.5">
                {row.id && !readOnly && !editMode ? (
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={(checked) => toggleItem(row.id!, checked)}
                    aria-label={`${tx(locale, "Select", "Выбрать")} ${row.name}`}
                    className="ml-1"
                  />
                ) : null}
                <div className="ml-auto">{renderActions(row, true)}</div>
              </div>
            </article>
          );
        })}
        {!paged.length ? <EmptyState compact icon={emptyState.icon} title={emptyState.title} action={emptyState.action} /> : null}
      </div>

      <SelectionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} locale={locale}>
        <Button type="button" variant="secondary" size="sm" onClick={bulkExport} disabled={isExportPending}>
          <Download className="h-3.5 w-3.5" />{isExportPending ? tx(locale, "Exporting…", "Экспорт…") : tx(locale, "Export", "Экспорт")}
        </Button>
        {!readOnly ? (
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" />{tx(locale, "Delete", "Удалить")}
          </Button>
        ) : null}
      </SelectionBar>

      <TablePagination
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
        locale={locale}
      />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        destructive
        title={tx(locale, "Discard unsaved changes?", "Отменить несохранённые изменения?")}
        description={tx(
          locale,
          `Edits to ${count(locale, dirtyRows.length, { one: "row", other: "rows", ru: ["строка", "строки", "строк"] })} will be lost and the table leaves edit mode.`,
          `Изменения (${count(locale, dirtyRows.length, { one: "row", other: "rows", ru: ["строка", "строки", "строк"] })}) будут потеряны, а таблица выйдет из режима правки.`,
        )}
        confirmLabel={tx(locale, "Discard", "Отменить изменения")}
        cancelLabel={tx(locale, "Keep editing", "Продолжить правку")}
        onConfirm={() => {
          setDiscardOpen(false);
          discardAll();
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        pending={isPending}
        title={tx(locale, "Delete selected entries?", "Удалить выбранные записи?")}
        description={tx(locale, `This permanently deletes ${selectedIds.size} entries.`, `Будут безвозвратно удалены выбранные записи (${selectedIds.size}).`)}
        confirmLabel={tx(locale, "Delete", "Удалить")}
        cancelLabel={tx(locale, "Cancel", "Отмена")}
        onConfirm={bulkDelete}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => { if (!next) setDeleteTarget(null); }}
        destructive
        pending={isPending}
        title={tx(locale, "Delete entry?", "Удалить запись?")}
        description={deleteTarget ? tx(
          locale,
          `“${deleteTarget.name}” will be deleted permanently. To keep it out of the way instead, archive it.`,
          `«${deleteTarget.name}» будет удалена безвозвратно. Если нужно просто убрать её из списка, отправьте её в архив.`,
        ) : undefined}
        confirmLabel={tx(locale, "Delete", "Удалить")}
        cancelLabel={tx(locale, "Cancel", "Отмена")}
        onConfirm={() => {
          if (deleteTarget) runItemAction(deleteItemAction, deleteTarget.id, () => setDeleteTarget(null));
        }}
      />
      {quickLogin ? (
        <QuickLoginDialog
          open={quickLogin.open}
          onOpenChange={(open) => setQuickLogin((current) => (current ? { ...current, open } : current))}
          workspaceId={workspaceId}
          itemId={quickLogin.id}
          locale={locale}
        />
      ) : null}
    </fieldset>
  );
}

