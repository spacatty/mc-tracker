"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, ArchiveRestore, SearchX, Trash2 } from "lucide-react";
import { deleteArchivedItemAction, deleteArchivedItemsAction, restoreItemAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { count, t } from "@/lib/i18n";
import type { PaymentItem } from "@/lib/types";
import { displayDate, formatMoney } from "@/lib/utils";
import { AppIcon } from "./icons";
import { CopyHost, VendorAccount } from "./host-line";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { EmptyState } from "./ui/empty-state";
import { SearchInput } from "./ui/input";
import { RowAction, RowActionMenu, RowActions } from "./ui/row-actions";
import { SectionCard } from "./ui/section-card";
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
  TableSelectCell,
  TableSelectHead,
  TableToolbar,
} from "./ui/table";

type SortKey = "name" | "category" | "archived" | "amount";

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

function valueFor(item: PaymentItem, key: SortKey) {
  if (key === "name") return item.name;
  if (key === "category") return item.categoryName || "";
  if (key === "archived") return item.archivedAt || "";
  return item.amount;
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
  const [deleteTarget, setDeleteTarget] = useState<PaymentItem | null>(null);
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
  const columnCount = readOnlyWorkspace ? 7 : 8;

  function sortProps(key: SortKey) {
    return { sortable: true, sorted: sortKey === key ? direction : (false as const), onSort: () => changeSort(key) };
  }

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

  function runItemAction(action: (formData: FormData) => Promise<void>, id: number, onDone?: () => void) {
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("workspaceId", String(workspaceId));
    startTransition(async () => {
      await action(formData);
      setSelectedIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      onDone?.();
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
    return <EmptyState icon={<Archive />} title={t(locale, "noArchivedEntries")} />;
  }

  return (
    <SectionCard flush className="flex min-h-[24rem] flex-1 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">
      <TableToolbar end={<span className="text-xs tabular-nums text-zinc-500">{count(locale, filtered.length, { one: "entry", other: "entries", ru: ["запись", "записи", "записей"] })}</span>}>
        <SearchInput
          size="sm"
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder={tx(locale, "Search archive…", "Поиск в архиве…")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="max-w-sm flex-1"
        />
      </TableToolbar>

      <Table bare fill minWidth={960}>
        <TableHeader>
          <TableRow>
            <TableSelectHead
              checked={pageSelectState}
              onCheckedChange={toggleAllOnPage}
              disabled={!paged.length || readOnlyWorkspace}
              label={tx(locale, "Select all entries", "Выбрать все записи")}
            />
            <TableHead {...sortProps("name")}>{t(locale, "name")}</TableHead>
            <TableHead width="12.5rem">{tx(locale, "Identifier", "Идентификатор")}</TableHead>
            <TableHead width="10rem" {...sortProps("category")}>{t(locale, "category")}</TableHead>
            <TableHead width="14rem">{tx(locale, "Vendor / account", "Поставщик / аккаунт")}</TableHead>
            <TableHead width="8rem" align="center" {...sortProps("archived")}>{t(locale, "archived")}</TableHead>
            <TableHead width="7.5rem" align="right" {...sortProps("amount")}>{t(locale, "amount")}</TableHead>
            {!readOnlyWorkspace ? (
              <TableHead align="right" width="1%">
                <span className="sr-only">{t(locale, "actions")}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((item) => {
            const selected = selectedIds.has(item.id);
            return (
              <TableRow key={item.id} selected={selected}>
                <TableSelectCell
                  checked={selected}
                  onCheckedChange={(checked) => toggleItem(item.id, checked)}
                  disabled={readOnlyWorkspace}
                  label={tx(locale, `Select ${item.name}`, `Выбрать ${item.name}`)}
                />
                <TableCell primary>
                  <span className="block max-w-xs truncate">{item.name}</span>
                  {item.notes ? (
                    <span className="mt-0.5 block max-w-xs truncate text-[11.5px] font-normal text-zinc-500">
                      {item.notes.replace(/<[^>]+>/g, "")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{item.host ? <CopyHost value={item.host} locale={locale} className="mt-0 max-w-full" /> : <span className="text-zinc-700">—</span>}</TableCell>
                <TableCell>
                  <Badge color={item.categoryColor || undefined} icon={<AppIcon name={item.categoryIcon} />}>
                    {item.categoryName || tx(locale, "Uncategorized", "Без категории")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <VendorAccount vendor={item.vendorName} account={item.accountName} className="max-w-64" />
                </TableCell>
                <TableCell muted align="center" className="whitespace-nowrap tabular-nums">{displayDate(item.archivedAt)}</TableCell>
                <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums text-zinc-100">
                  {formatMoney(item.amount, item.currency)}
                </TableCell>
                {!readOnlyWorkspace ? (
                  <TableCell align="right" className="w-[1%] whitespace-nowrap">
                    <RowActions>
                      <RowAction
                        label={t(locale, "restore")}
                        icon={<ArchiveRestore />}
                        hidden="hover"
                        disabled={isPending}
                        onClick={() => runItemAction(restoreItemAction, item.id)}
                      />
                      <RowActionMenu
                        label={tx(locale, `More actions for ${item.name}`, `Другие действия: ${item.name}`)}
                        disabled={isPending}
                        items={[
                          { label: t(locale, "restore"), icon: <ArchiveRestore />, onSelect: () => runItemAction(restoreItemAction, item.id) },
                          "separator",
                          { label: t(locale, "deletePermanently"), icon: <Trash2 />, destructive: true, onSelect: () => setDeleteTarget(item) },
                        ]}
                      />
                    </RowActions>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
          {!filtered.length ? (
            <TableEmpty colSpan={columnCount} icon={<SearchX />} title={t(locale, "noEntriesMatch")} />
          ) : null}
        </TableBody>
      </Table>

      {!readOnlyWorkspace ? (
        <SelectionBar count={selectedCount} onClear={() => setSelectedIds(new Set())} locale={locale}>
          <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmOpen(true)} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" />
            {tx(locale, "Delete permanently", "Удалить навсегда")}
          </Button>
        </SelectionBar>
      ) : null}

      <TablePagination
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        locale={locale}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        pending={isPending}
        title={t(locale, "confirmDeleteArchivedTitle")}
        description={t(locale, "confirmDeleteArchived")}
        confirmLabel={tx(locale, `Delete ${selectedCount}`, `Удалить (${selectedCount})`)}
        cancelLabel={tx(locale, "Cancel", "Отмена")}
        onConfirm={handleBulkDelete}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        destructive
        pending={isPending}
        title={tx(locale, "Delete permanently?", "Удалить навсегда?")}
        description={
          deleteTarget
            ? tx(
                locale,
                `“${deleteTarget.name}” will be deleted for good. This cannot be undone.`,
                `«${deleteTarget.name}» будет удалена навсегда. Это действие нельзя отменить.`,
              )
            : undefined
        }
        confirmLabel={t(locale, "deletePermanently")}
        cancelLabel={tx(locale, "Cancel", "Отмена")}
        onConfirm={() => {
          if (deleteTarget) runItemAction(deleteArchivedItemAction, deleteTarget.id, () => setDeleteTarget(null));
        }}
      />
    </SectionCard>
  );
}
