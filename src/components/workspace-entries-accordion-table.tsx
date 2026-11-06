"use client";

import { Archive, ArrowUpRight, Inbox, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { archiveItemAction, deleteItemAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { count, t } from "@/lib/i18n";
import { AppIcon } from "./icons";
import { VendorAccount } from "./host-line";
import { Badge } from "./ui/badge";
import { ConfirmDialog } from "./ui/dialog";
import { SearchInput } from "./ui/input";
import { RowAction, RowActionMenu, RowActions } from "./ui/row-actions";
import {
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

type WorkspaceEntry = {
  id: number;
  name: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  vendorName?: string;
  accountName?: string;
  createdAt: string;
};

const PAGE_SIZE = 10;

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

/** The entries of one workspace (Workspaces → Entries tab): search, open, archive, delete. */
export function WorkspaceEntriesTable({
  workspaceId,
  workspaceRole,
  entries,
  locale = "en",
}: {
  workspaceId: number;
  workspaceRole: "owner" | "editor" | "viewer";
  entries: WorkspaceEntry[];
  locale?: Locale;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceEntry | null>(null);
  const [pending, startTransition] = useTransition();
  const canEdit = workspaceRole !== "viewer";

  const filtered = useMemo(
    () =>
      entries
        .filter((entry) =>
          fuzzyMatch(`${entry.name} ${entry.categoryName || ""} ${entry.vendorName || ""} ${entry.accountName || ""}`, query),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries, query],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const columns = canEdit ? 4 : 3;

  const entryHref = (entry: WorkspaceEntry) => `/app/items?workspace=${workspaceId}&entry=${entry.id}`;

  function entryForm(entry: WorkspaceEntry) {
    const formData = new FormData();
    formData.set("id", String(entry.id));
    formData.set("workspaceId", String(workspaceId));
    return formData;
  }

  function archive(entry: WorkspaceEntry) {
    startTransition(async () => {
      await archiveItemAction(entryForm(entry));
      router.refresh();
    });
  }

  function remove() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      await deleteItemAction(entryForm(target));
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06]">
      <TableToolbar
        end={
          <span className="text-xs tabular-nums text-zinc-500">
            {query
              ? tx(locale, `${filtered.length} of ${entries.length}`, `${filtered.length} из ${entries.length}`)
              : count(locale, entries.length, { one: "entry", other: "entries", ru: ["запись", "записи", "записей"] })}
            {!canEdit ? <span className="ml-2 text-zinc-600">· {tx(locale, "View only", "Только просмотр")}</span> : null}
          </span>
        }
      >
        <SearchInput
          size="sm"
          value={query}
          onChange={(next) => {
            setQuery(next);
            setPage(1);
          }}
          placeholder={tx(locale, "Filter entries", "Поиск записей")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="max-w-sm flex-1"
        />
      </TableToolbar>
      <Table bare minWidth={560}>
        <TableHeader>
          <TableRow>
            <TableHead>{t(locale, "name")}</TableHead>
            <TableHead>{t(locale, "category")}</TableHead>
            <TableHead>{tx(locale, "Account / vendor", "Аккаунт / поставщик")}</TableHead>
            {canEdit ? (
              <TableHead align="right" className="w-[1%]">
                <span className="sr-only">{t(locale, "actions")}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry) => (
            <TableRow key={entry.id} interactive onClick={() => router.push(entryHref(entry))}>
              <TableCell primary>
                <span className="block max-w-72 truncate">{entry.name}</span>
              </TableCell>
              <TableCell>
                <Badge color={entry.categoryColor} icon={<AppIcon name={entry.categoryIcon} />}>
                  {entry.categoryName || t(locale, "uncategorized")}
                </Badge>
              </TableCell>
              <TableCell>
                {entry.accountName || entry.vendorName ? (
                  <>
                    <VendorAccount vendor={entry.vendorName} account={entry.accountName} className="max-w-64" />
                  </>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </TableCell>
              {canEdit ? (
                <TableCell align="right" className="w-[1%] whitespace-nowrap">
                  <RowActions>
                    <RowAction
                      label={t(locale, "archive")}
                      icon={<Archive />}
                      hidden="hover"
                      disabled={pending}
                      onClick={() => archive(entry)}
                    />
                    <RowActionMenu
                      label={tx(locale, `More actions for ${entry.name}`, `Ещё действия: ${entry.name}`)}
                      items={[
                        { label: tx(locale, "Open entry", "Открыть запись"), icon: <ArrowUpRight />, href: entryHref(entry) },
                        { label: t(locale, "archive"), icon: <Archive />, onSelect: () => archive(entry), disabled: pending },
                        "separator",
                        { label: t(locale, "delete"), icon: <Trash2 />, destructive: true, onSelect: () => setDeleteTarget(entry) },
                      ]}
                    />
                  </RowActions>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {!rows.length ? (
            <TableEmpty
              colSpan={columns}
              icon={<Inbox />}
              title={entries.length ? tx(locale, "Nothing matches", "Ничего не найдено") : t(locale, "noEntriesYet")}
              description={entries.length ? tx(locale, "Try a different search.", "Попробуйте другой запрос.") : undefined}
            />
          ) : null}
        </TableBody>
      </Table>
      {filtered.length > PAGE_SIZE || pageSize !== PAGE_SIZE ? (
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          total={filtered.length}
          locale={locale}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        destructive
        pending={pending}
        title={tx(locale, `Delete ${deleteTarget?.name ?? "entry"}?`, `Удалить «${deleteTarget?.name ?? "запись"}»?`)}
        description={tx(locale, "The entry is deleted permanently. This cannot be undone.", "Запись будет удалена навсегда. Это действие нельзя отменить.")}
        confirmLabel={t(locale, "delete")}
        cancelLabel={t(locale, "cancel")}
        onConfirm={remove}
      />
    </div>
  );
}

/** @deprecated Old name, kept for imports; the accordion is gone. */
export const WorkspaceEntriesAccordionTable = WorkspaceEntriesTable;
