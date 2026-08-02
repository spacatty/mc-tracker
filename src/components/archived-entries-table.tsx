"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArchiveRestore, ArrowUpDown, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { deleteArchivedItemAction, deleteArchivedItemsAction, restoreItemAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { PaymentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayDate, formatMoney } from "@/lib/utils";
import { AppIcon } from "./icons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type SortKey = "name" | "category" | "archived" | "amount";

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
  if (key === "archived") return item.archivedAt || "";
  return item.amount;
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

function ActionIcon({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "sky" | "red" }) {
  const toneClass = {
    violet: "bg-violet-500/10 text-violet-200",
    sky: "bg-sky-500/10 text-sky-200",
    red: "bg-red-500/10 text-red-200",
  }[tone];

  return <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass}`}>{children}</span>;
}

export function ArchivedEntriesTable({
  items,
  workspaceId,
  workspaceRole,
  locale = "en",
}: {
  items: PaymentItem[];
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  locale?: Locale;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("archived");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState(() => new Set<number>());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const readOnlyWorkspace = workspaceRole === "viewer";

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "amount" || key === "archived" ? "desc" : "asc");
  }

  const filtered = useMemo(
    () =>
      items
        .filter((item) =>
          fuzzyMatch(`${item.name} ${item.vendorName} ${item.vendorUrl} ${item.accountName} ${item.categoryName}`, query),
        )
        .sort((a, b) => {
          const aValue = valueFor(a, sortKey);
          const bValue = valueFor(b, sortKey);
          const result = typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue));
          return direction === "asc" ? result : -result;
        }),
    [direction, items, query, sortKey],
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

  function runItemAction(action: (formData: FormData) => Promise<void>, id: number) {
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("workspaceId", String(workspaceId));
    startTransition(async () => {
      await action(formData);
    });
  }

  function handleBulkDelete() {
    const formData = new FormData();
    formData.set("workspaceId", String(workspaceId));
    selectedIds.forEach((id) => formData.append("ids", String(id)));
    startTransition(async () => {
      await deleteArchivedItemsAction(formData);
      setSelectedIds(new Set());
      setConfirmOpen(false);
    });
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
        <p className="text-zinc-500">{t(locale, "noArchivedEntries")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={locale === "ru" ? "Поиск в архиве..." : "Search archive..."}
            className="pl-9"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="min-w-[1120px]">
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
              <TableHead className="text-zinc-300"><SortButton label={t(locale, "category")} sortKey="category" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="text-zinc-300">{t(locale, "account")}</TableHead>
              <TableHead className="text-center text-zinc-300"><SortButton label={t(locale, "archived")} sortKey="archived" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-center text-zinc-300"><SortButton label={t(locale, "amount")} sortKey="amount" active={sortKey} direction={direction} onClick={changeSort} /></TableHead>
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
                    <span className="font-semibold text-white">{item.name}</span>
                    {item.notes ? <p className="mt-1 line-clamp-1 max-w-xs text-xs text-zinc-500">{item.notes.replace(/<[^>]+>/g, "")}</p> : null}
                  </TableCell>
                  <TableCell>
                    <Badge className="gap-2 border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" style={{ backgroundColor: `${item.categoryColor || "#8b5cf6"}20`, color: item.categoryColor || "#c4b5fd" }}>
                      <AppIcon name={item.categoryIcon} className="h-3.5 w-3.5" />
                      {item.categoryName || (locale === "ru" ? "Без категории" : "Uncategorized")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-zinc-100">{item.accountName || "-"}</p>
                      {item.vendorName ? <p className="max-w-52 truncate text-xs text-zinc-400">{item.vendorName}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center text-xs text-zinc-400">{displayDate(item.archivedAt)}</TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap text-center font-semibold text-white">{formatMoney(item.amount, item.currency)}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-9 w-9 border border-white/10 bg-white/[0.04] hover:bg-white/[0.1]">
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 p-2">
                        {!readOnlyWorkspace ? (
                          <DropdownMenuItem
                            className="gap-3 rounded-xl px-3 py-2.5 text-sky-200"
                            disabled={isPending}
                            onSelect={() => runItemAction(restoreItemAction, item.id)}
                          >
                            <ActionIcon tone="sky"><ArchiveRestore className="h-4 w-4" /></ActionIcon>
                            <span className="font-medium">{t(locale, "restore")}</span>
                          </DropdownMenuItem>
                        ) : null}
                        {!readOnlyWorkspace ? (
                          <DropdownMenuItem
                            className="gap-3 rounded-xl px-3 py-2.5 text-red-200"
                            disabled={isPending}
                            onSelect={() => runItemAction(deleteArchivedItemAction, item.id)}
                          >
                            <ActionIcon tone="red"><Trash2 className="h-4 w-4" /></ActionIcon>
                            <span className="font-medium">{t(locale, "deletePermanently")}</span>
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length ? (
              <TableRow><TableCell colSpan={7} className="px-5 py-12 text-center text-zinc-500">{t(locale, "noEntriesMatch")}</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <div className="space-y-1">
          {selectedCount > 0 && !readOnlyWorkspace ? (
            <div className="flex min-h-9 items-center gap-2">
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
                        <Dialog.Title className="text-lg font-semibold text-white">{t(locale, "confirmDeleteArchivedTitle")}</Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
                          {t(locale, "confirmDeleteArchived")}
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
