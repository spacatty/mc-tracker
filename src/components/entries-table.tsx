"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowUpDown, Check, ChevronLeft, ChevronRight, Copy, Download, Edit3, ExternalLink, Filter, MoreHorizontal, Search, Trash2, X } from "lucide-react";
import { deleteItemAction, deleteItemsAction, exportSelectedEntriesAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { CategoryField, PaymentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayDate, formatMoney, periodLabel } from "@/lib/utils";
import { CopyUrlMenuItem } from "./copy-url-menu-item";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type SortKey = "name" | "category" | "vendor" | "created" | "date" | "amount" | "billing";

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

function valueFor(item: PaymentItem, key: SortKey) {
  if (key === "name") return item.name;
  if (key === "category") return item.categoryName || "";
  if (key === "vendor") return `${item.vendorName} ${item.vendorUrl} ${item.accountName}`;
  if (key === "created") return item.createdAt;
  if (key === "date") return item.billingEndAt || item.billingStartAt || "";
  if (key === "amount") return item.amount;
  return item.period || item.paymentType;
}

function SortButton({ label, sortKey, active, direction, onClick }: { label: string; sortKey: SortKey; active: SortKey; direction: "asc" | "desc"; onClick: (key: SortKey) => void }) {
  return (
    <button type="button" onClick={() => onClick(sortKey)} className="inline-flex items-center gap-1 hover:text-white">
      {label}
      <ArrowUpDown className={active === sortKey ? "h-3.5 w-3.5 text-violet-300" : "h-3.5 w-3.5 text-zinc-600"} />
      {active === sortKey ? <span className="sr-only">{direction}</span> : null}
    </button>
  );
}

function customFieldValue(item: PaymentItem, field: CategoryField) {
  const value = item.customFields[field.id];
  if (field.type === "checkbox") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function shortBillingLabel(item: PaymentItem) {
  if (item.paymentType !== "recurring") return "S";
  if (item.period === "1m") return "1 M";
  if (item.period === "3m") return "3 M";
  if (item.period === "1y") return "1 Y";
  if (item.period === "7d") return "7 D";
  if (item.period === "custom") return `${item.customPeriodDays || 30} D`;
  return periodLabel(item.period, item.customPeriodDays);
}

function ActionIcon({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "sky" | "red" }) {
  const toneClass = {
    violet: "bg-violet-500/10 text-violet-200",
    sky: "bg-sky-500/10 text-sky-200",
    red: "bg-red-500/10 text-red-200",
  }[tone];

  return <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass}`}>{children}</span>;
}

function CopyableValue({
  value,
  children,
  className,
  style,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);

  if (!value || value === "-") {
    return <span className={className} style={style}>{children}</span>;
  }

  return (
    <button
      type="button"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg text-left transition hover:bg-white/[0.06] ${className || ""}`}
      style={style}
      title="Copy value"
      onClick={async () => {
        await navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      <span className="truncate">{children}</span>
      {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
    </button>
  );
}

export function EntriesTable({
  items,
  workspaceId,
  workspaceRole,
  visibleFields = [],
  showCategory = true,
  locale = "en",
}: {
  items: PaymentItem[];
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  visibleFields?: CategoryField[];
  showCategory?: boolean;
  locale?: Locale;
}) {
  const [query, setQuery] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState(() => new Set<number>());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isExportPending, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState("");
  const readOnlyWorkspace = workspaceRole === "viewer";

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "amount" || key === "created" ? "desc" : "asc");
  }

  const activeFilterCount = [nameFilter, accountFilter, vendorFilter].filter((value) => value.trim()).length;

  function clearFilters() {
    setNameFilter("");
    setAccountFilter("");
    setVendorFilter("");
    setPage(1);
  }

  const filtered = useMemo(
    () =>
      items
        .filter((item) =>
          fuzzyMatch(`${item.name} ${item.vendorName} ${item.vendorUrl} ${item.accountName} ${item.categoryName} ${visibleFields.map((field) => customFieldValue(item, field)).join(" ")}`, query),
        )
        .filter((item) => fuzzyMatch(item.name, nameFilter))
        .filter((item) => fuzzyMatch(item.accountName, accountFilter))
        .filter((item) => fuzzyMatch(`${item.vendorName} ${item.vendorUrl}`, vendorFilter))
        .sort((a, b) => {
          const aValue = valueFor(a, sortKey);
          const bValue = valueFor(b, sortKey);
          const result = typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue));
          return direction === "asc" ? result : -result;
        }),
    [accountFilter, direction, items, nameFilter, query, sortKey, vendorFilter, visibleFields],
  );
  const nameSuggestions = useMemo(
    () =>
      [...new Set(items.map((item) => item.name).filter((value) => fuzzyMatch(value, nameFilter) && value.trim()))]
        .slice(0, 12),
    [items, nameFilter],
  );
  const accountSuggestions = useMemo(
    () =>
      [...new Set(items.map((item) => item.accountName).filter((value) => fuzzyMatch(value, accountFilter) && value.trim()))]
        .slice(0, 12),
    [accountFilter, items],
  );
  const vendorSuggestions = useMemo(
    () =>
      [
        ...new Set(
          items
            .flatMap((item) => [item.vendorName, item.vendorUrl].filter(Boolean))
            .filter((value) => fuzzyMatch(String(value), vendorFilter)),
        ),
      ]
        .map(String)
        .filter((value) => value.trim())
        .slice(0, 12),
    [items, vendorFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);
  const pagedIds = paged.map((item) => item.id);
  const selectedOnPageCount = pagedIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pagedIds.length > 0 && selectedOnPageCount === pagedIds.length;
  const pageSelectState = allPageSelected ? true : selectedOnPageCount > 0 ? "indeterminate" : false;
  const selectedCount = selectedIds.size;

  function toggleItem(id: number, checked: boolean | "indeterminate") {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllOnPage(checked: boolean | "indeterminate") {
    setSelectedIds((current) => {
      const next = new Set(current);
      pagedIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  function handleBulkDelete() {
    const formData = new FormData();
    formData.set("workspaceId", String(workspaceId));
    selectedIds.forEach((id) => formData.append("ids", String(id)));
    startTransition(async () => {
      await deleteItemsAction(formData);
      setSelectedIds(new Set());
      setConfirmOpen(false);
    });
  }

  function handleBulkExport() {
    if (!selectedIds.size) return;
    setExportError("");
    const ids = [...selectedIds];
    startExportTransition(async () => {
      try {
        const json = await exportSelectedEntriesAction(workspaceId, ids);
        const fileName = `entries-export-w${workspaceId}-${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "Export failed.");
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 p-4">
        <div className="w-full space-y-3">
          {workspaceRole !== "owner" ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/35 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
              {locale === "ru" ? "Общее пространство" : "Shared workspace"}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={locale === "ru" ? "Глобальный поиск..." : "Global fuzzy search..."}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setFiltersOpen((current) => !current)}>
                <Filter className="h-4 w-4" />
                {t(locale, "filters")}{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Button>
              {activeFilterCount ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                  {t(locale, "clearFilters")}
                </Button>
              ) : null}
            </div>
          </div>
          {filtersOpen ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{locale === "ru" ? "Фильтры (И)" : "Chained filters (AND)"}</p>
                <p className="text-xs text-zinc-600">{locale === "ru" ? "Название + Аккаунт + Вендор/URL" : "Name + Account + Vendor/URL"}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input value={nameFilter} onChange={(event) => { setNameFilter(event.target.value); setPage(1); }} placeholder={locale === "ru" ? "Фильтр по названию..." : "Filter by name..."} list="entry-name-filter-suggestions" />
                <datalist id="entry-name-filter-suggestions">
                  {nameSuggestions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <Input value={accountFilter} onChange={(event) => { setAccountFilter(event.target.value); setPage(1); }} placeholder={locale === "ru" ? "Фильтр по аккаунту..." : "Filter by account..."} list="entry-account-filter-suggestions" />
                <datalist id="entry-account-filter-suggestions">
                  {accountSuggestions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <Input value={vendorFilter} onChange={(event) => { setVendorFilter(event.target.value); setPage(1); }} placeholder={locale === "ru" ? "Фильтр по вендору или URL..." : "Filter vendor or URL..."} list="entry-vendor-filter-suggestions" />
                <datalist id="entry-vendor-filter-suggestions">
                  {vendorSuggestions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Table className={visibleFields.length ? "min-w-[1340px]" : "min-w-[1120px]"}>
          <TableHeader className="sticky top-0 z-20 bg-[#0b0b10]/95 backdrop-blur-md">
            <TableRow className="border-b border-white/10 bg-white/[0.02]">
              <TableHead className="w-12">
                <Checkbox
                  checked={pageSelectState}
                  onCheckedChange={toggleAllOnPage}
                  disabled={!paged.length || readOnlyWorkspace}
                  aria-label={locale === "ru" ? "Выбрать все записи" : "Select all entries"}
                />
              </TableHead>
              <TableHead className="text-zinc-300"><SortButton label={t(locale, "name")} sortKey="name" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              {visibleFields.map((field) => (
                <TableHead key={field.id} className="text-zinc-300">{field.label}</TableHead>
              ))}
              {showCategory ? <TableHead className="text-zinc-300"><SortButton label={t(locale, "category")} sortKey="category" active={sortKey} direction={direction} onClick={changeSort} /></TableHead> : null}
              <TableHead className="text-zinc-300"><SortButton label={t(locale, "account")} sortKey="vendor" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="text-center text-zinc-300"><SortButton label={t(locale, "created")} sortKey="created" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="text-center text-zinc-300"><SortButton label={t(locale, "dates")} sortKey="date" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-center text-zinc-300"><SortButton label={t(locale, "amount")} sortKey="amount" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="w-[76px] text-center text-zinc-300"><SortButton label={t(locale, "billing")} sortKey="billing" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="w-32 text-center text-zinc-300">{t(locale, "actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((item) => {
              const selected = selectedIds.has(item.id);
              return (
              <TableRow
                key={item.id}
                className={cn(
                  "group border-white/5 bg-[#0b0b10] transition-colors duration-150 even:bg-[#0d0d12] hover:bg-[#15151d]",
                  selected && "bg-[#171329] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.38)] even:bg-[#171329]",
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={(checked) => toggleItem(item.id, checked)}
                    disabled={readOnlyWorkspace}
                    aria-label={`Select ${item.name}`}
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/app/items/${item.id}?workspace=${workspaceId}`} className="font-semibold text-white hover:text-sky-200">{item.name}</Link>
                  {item.notes ? <p className="mt-1 line-clamp-1 max-w-xs text-xs text-zinc-500">{item.notes.replace(/<[^>]+>/g, "")}</p> : null}
                </TableCell>
                {visibleFields.map((field) => (
                  <TableCell key={field.id} className={field.bold ? "font-semibold text-white" : undefined} style={{ color: field.color || undefined }}>
                    {field.copyable ? (
                      <CopyableValue value={customFieldValue(item, field)} className={field.bold ? "font-semibold text-white" : undefined} style={{ color: field.color || undefined }}>
                        {customFieldValue(item, field)}
                      </CopyableValue>
                    ) : (
                      customFieldValue(item, field)
                    )}
                  </TableCell>
                ))}
                {showCategory ? (
                  <TableCell>
                    <Badge className="gap-2 border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}20`, color: item.categoryColor || "#c4b5fd" }}>
                      <AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" />
                      {item.categoryName || (locale === "ru" ? "Без категории" : "Uncategorized")}
                    </Badge>
                  </TableCell>
                ) : null}
                <TableCell>
                  <div>
                    <p className="font-medium text-zinc-100">{item.accountName || "-"}</p>
                    {item.vendorName ? <p className="max-w-52 truncate text-xs text-zinc-400">{item.vendorName}</p> : null}
                    {item.vendorUrl ? (
                      <a href={item.vendorUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-52 items-center gap-1 truncate text-xs text-zinc-500 hover:text-zinc-300">
                        <span className="truncate">{item.vendorUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-center text-xs text-zinc-400">{displayDate(item.createdAt)}</TableCell>
                <TableCell className="text-xs text-zinc-400">
                  <div className="flex flex-col items-center text-center leading-tight">
                    <span>{displayDate(item.billingStartAt)}</span>
                    <span className="py-0.5 text-zinc-600">-&gt;</span>
                    <span>{displayDate(item.billingEndAt)}</span>
                  </div>
                </TableCell>
                <TableCell className="w-[1%] whitespace-nowrap text-center font-semibold text-white">{formatMoney(item.amount, item.currency)}</TableCell>
                <TableCell className="w-[76px] text-center">
                  <Badge variant={item.paymentType === "recurring" ? "success" : "secondary"}>
                    {shortBillingLabel(item)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-9 w-9 border border-white/10 bg-white/[0.04] hover:bg-white/[0.1]">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2">
                      {!readOnlyWorkspace ? (
                        <DropdownMenuItem asChild className="gap-3 rounded-xl px-3 py-2.5">
                          <Link href={`/app/items/${item.id}?workspace=${workspaceId}`}>
                            <ActionIcon tone="sky"><Edit3 className="h-4 w-4" /></ActionIcon>
                            <span className="font-medium">{t(locale, "edit")}</span>
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      {item.vendorUrl ? <CopyUrlMenuItem url={item.vendorUrl} /> : null}
                      {!readOnlyWorkspace ? (
                        <form action={deleteItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="workspaceId" value={workspaceId} />
                          <DropdownMenuItem asChild className="gap-3 rounded-xl px-3 py-2.5">
                            <button type="submit" className="flex w-full items-center gap-3 text-red-200">
                              <ActionIcon tone="red"><Trash2 className="h-4 w-4" /></ActionIcon>
                              <span className="font-medium">{t(locale, "delete")}</span>
                            </button>
                          </DropdownMenuItem>
                        </form>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
            })}
            {!filtered.length ? (
              <TableRow><TableCell colSpan={(showCategory ? 9 : 8) + visibleFields.length} className="px-5 py-12 text-center text-zinc-500">{t(locale, "noEntriesMatch")}</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <div className="space-y-1">
          {selectedCount > 0 && !readOnlyWorkspace ? (
            <div className="flex min-h-9 items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="border border-sky-400/25 bg-sky-500/[0.08] px-2.5 text-sky-100 hover:border-sky-300/35 hover:bg-sky-500/15 hover:text-white"
                title={locale === "ru" ? `Экспортировать выбранные: ${selectedCount}` : `Export ${selectedCount} selected`}
                onClick={handleBulkExport}
                disabled={isExportPending}
              >
                <Download className="h-4 w-4" />
                <span className="text-sm font-semibold">{isExportPending ? (locale === "ru" ? "Экспорт..." : "Exporting...") : locale === "ru" ? "Экспорт" : "Export"}</span>
              </Button>
              <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
                <Dialog.Trigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-red-400/20 bg-red-500/[0.06] px-2.5 text-red-100 hover:border-red-300/30 hover:bg-red-500/10 hover:text-white"
                    title={locale === "ru" ? `Удалить выбранные: ${selectedCount}` : `Delete ${selectedCount} selected`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="min-w-5 text-center text-sm font-semibold">{selectedCount}</span>
                  </Button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0b0b10] p-6 shadow-2xl shadow-black/50">
                    <div className="flex gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-200">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <Dialog.Title className="text-lg font-semibold text-white">{locale === "ru" ? "Удалить выбранные записи?" : "Delete selected entries?"}</Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
                          {locale === "ru"
                            ? `Будет удалено выбранных записей: ${selectedCount}. Это действие нельзя отменить.`
                            : `This will permanently delete ${selectedCount} selected ${selectedCount === 1 ? "entry" : "entries"}. This action cannot be undone.`}
                        </Dialog.Description>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <Dialog.Close asChild>
                        <Button type="button" variant="secondary" disabled={isPending}>Cancel</Button>
                      </Dialog.Close>
                      <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={isPending || selectedCount === 0}>
                        {isPending ? (locale === "ru" ? "Удаление..." : "Deleting...") : locale === "ru" ? "Удалить все" : "Delete All"}
                      </Button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          ) : null}
          {exportError ? <p className="text-xs text-red-300">{exportError}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[78px] border-white/10 bg-black/30 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="px-2.5 py-1 text-xs text-zinc-300">
            {safePage}/{totalPages}
          </Badge>
          <Button type="button" variant="secondary" size="icon" className="h-9 w-9" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
