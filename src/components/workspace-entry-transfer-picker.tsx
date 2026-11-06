"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRightLeft, Copy, Loader2 } from "lucide-react";
import { transferWorkspaceEntriesAction } from "@/app/actions";
import { tx } from "@/components/capture/shared";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CurrentWorkspaceInput } from "./current-workspace-input";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Field } from "./ui/field";
import { SearchInput } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type WorkspaceEntry = {
  id: number;
  name: string;
  categoryName?: string;
  vendorName?: string;
  accountName?: string;
  workspaceId?: number;
  workspaceName?: string;
  workspaceEmoji?: string;
};

type WorkspaceOption = {
  id: number;
  name: string;
  emoji: string;
  accessRole: "owner" | "editor" | "viewer";
};

const RESULT_LIMIT = 50;

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

function entrySignature(entry: WorkspaceEntry) {
  return [entry.name, entry.categoryName || "", entry.vendorName || "", entry.accountName || ""]
    .join("\u001f")
    .trim()
    .toLowerCase();
}

function SubmitButton({ count, move, locale }: { count: number; move: boolean; locale: Locale }) {
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : move ? ArrowRightLeft : Copy;
  return (
    <Button type="submit" size="sm" variant="accent" disabled={!count || pending}>
      <Icon className={cn("h-3.5 w-3.5", pending && "animate-spin")} aria-hidden="true" />
      {move
        ? tx(locale, count ? `Move ${count} here` : "Move here", count ? `Перенести сюда: ${count}` : "Перенести сюда")
        : tx(locale, count ? `Copy ${count} here` : "Copy here", count ? `Скопировать сюда: ${count}` : "Скопировать сюда")}
    </Button>
  );
}

export function WorkspaceEntryTransferPicker({
  targetWorkspaceId,
  targetEntries,
  sourceWorkspaces,
  entriesByWorkspace,
  locale = "en",
}: {
  targetWorkspaceId: number;
  targetEntries: WorkspaceEntry[];
  sourceWorkspaces: WorkspaceOption[];
  entriesByWorkspace: Record<number, WorkspaceEntry[]>;
  locale?: Locale;
}) {
  const [sourceWorkspaceId, setSourceWorkspaceId] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());
  const [moveAcross, setMoveAcross] = useState(false);
  const sourceTriggerId = `transfer-source-${targetWorkspaceId}`;
  const moveId = `transfer-move-${targetWorkspaceId}`;

  const sourceEntries = useMemo(() => {
    if (sourceWorkspaceId === 0) {
      return sourceWorkspaces
        .filter((workspace) => workspace.id !== targetWorkspaceId)
        .flatMap((workspace) => entriesByWorkspace[workspace.id] || []);
    }
    return entriesByWorkspace[sourceWorkspaceId] || [];
  }, [entriesByWorkspace, sourceWorkspaceId, sourceWorkspaces, targetWorkspaceId]);
  const sameWorkspaceSelected = sourceWorkspaceId === targetWorkspaceId;
  const selectedSourceEntries = sourceEntries.filter((entry) => selectedSourceIds.has(entry.id));
  const targetSignatures = useMemo(() => new Set(targetEntries.map(entrySignature)), [targetEntries]);
  const candidates = useMemo(
    () =>
      sameWorkspaceSelected
        ? []
        : sourceEntries
          .filter((entry) => !targetSignatures.has(entrySignature(entry)))
          .filter((entry) => fuzzyMatch(`${entry.name} ${entry.categoryName || ""} ${entry.vendorName || ""} ${entry.accountName || ""}`, query)),
    [query, sameWorkspaceSelected, sourceEntries, targetSignatures],
  );
  const results = candidates.slice(0, RESULT_LIMIT);
  const allShownSelected = results.length > 0 && results.every((entry) => selectedSourceIds.has(entry.id));
  const someShownSelected = results.some((entry) => selectedSourceIds.has(entry.id));

  function toggle(id: number, checked: boolean) {
    setSelectedSourceIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleShown(checked: boolean) {
    setSelectedSourceIds((current) => {
      const next = new Set(current);
      for (const entry of results) {
        if (checked) next.add(entry.id);
        else next.delete(entry.id);
      }
      return next;
    });
  }

  return (
    <form action={transferWorkspaceEntriesAction} className="space-y-4">
      <input type="hidden" name="targetWorkspaceId" value={targetWorkspaceId} />
      <CurrentWorkspaceInput />
      <input type="hidden" name="mode" value={moveAcross ? "move" : "copy"} />
      <input type="hidden" name="sourceWorkspaceId" value={sourceWorkspaceId} />
      {[...selectedSourceIds].map((id) => <input key={id} type="hidden" name="entryIds" value={id} />)}

      {!sourceWorkspaces.length ? <Alert tone="info">{t(locale, "noWorkspacesYet")}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <Field label={t(locale, "sourceWorkspace")} htmlFor={sourceTriggerId}>
          <Select
            value={String(sourceWorkspaceId)}
            onValueChange={(value) => {
              setSourceWorkspaceId(Number(value || 0));
              setSelectedSourceIds(new Set());
              setQuery("");
            }}
          >
            <SelectTrigger id={sourceTriggerId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t(locale, "allWorkspaces")}</SelectItem>
              {sourceWorkspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={String(workspace.id)}>
                  {workspace.emoji} {workspace.name}
                  {workspace.id === targetWorkspaceId ? tx(locale, " (current)", " (текущее)") : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={tx(locale, "Find entries", "Найти записи")}>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={tx(locale, "Name, account, vendor, category…", "Название, аккаунт, поставщик, категория…")}
            aria-label={t(locale, "addEntriesFuzzySearch")}
            clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          />
        </Field>
      </div>

      {sameWorkspaceSelected ? (
        <Alert tone="info">{tx(locale, "Choose another source workspace to add entries.", "Выберите другое исходное пространство, чтобы добавить записи.")}</Alert>
      ) : sourceWorkspaces.length ? (
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <div className="flex h-9 items-center gap-3 border-b border-white/[0.06] px-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            <Checkbox
              checked={allShownSelected ? true : someShownSelected ? "indeterminate" : false}
              onCheckedChange={(next) => toggleShown(next === true)}
              disabled={!results.length}
              aria-label={tx(locale, "Select all shown", "Выбрать все показанные")}
            />
            <span className="flex-1">{t(locale, "entries")}</span>
            <span className="normal-case tracking-normal tabular-nums">
              {candidates.length > RESULT_LIMIT
                ? tx(locale, `First ${RESULT_LIMIT} of ${candidates.length}`, `Первые ${RESULT_LIMIT} из ${candidates.length}`)
                : candidates.length}
            </span>
          </div>
          <ul className="max-h-64 divide-y divide-white/[0.05] overflow-y-auto">
            {results.map((entry) => {
              const checked = selectedSourceIds.has(entry.id);
              const id = `transfer-${targetWorkspaceId}-${entry.id}`;
              return (
                <li key={entry.id}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-2 transition",
                      checked ? "bg-violet-500/[0.07]" : "hover:bg-white/[0.03]",
                    )}
                  >
                    <Checkbox id={id} checked={checked} onCheckedChange={(next) => toggle(entry.id, next === true)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-zinc-100">{entry.name}</span>
                      <span className="block truncate text-[11.5px] text-zinc-500">
                        {entry.categoryName || t(locale, "uncategorized")}
                        {entry.accountName || entry.vendorName ? ` · ${entry.accountName || entry.vendorName}` : ""}
                      </span>
                    </span>
                    <span className="hidden shrink-0 truncate text-[11.5px] text-zinc-500 sm:block">
                      {entry.workspaceEmoji || "📦"} {entry.workspaceName || t(locale, "workspace")}
                    </span>
                  </label>
                </li>
              );
            })}
            {!results.length ? (
              <li className="px-4 py-6 text-center text-[13px] text-zinc-500">
                {query
                  ? tx(locale, "No matching entries.", "Ничего не найдено.")
                  : tx(locale, "Nothing to add: every entry is already here.", "Добавить нечего: все записи уже здесь.")}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Checkbox
          id={moveId}
          checked={moveAcross}
          onCheckedChange={(next) => setMoveAcross(next === true)}
          aria-describedby={`${moveId}-description`}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <label htmlFor={moveId} className="cursor-pointer text-[13px] font-medium text-zinc-200">
            {t(locale, "moveAcrossWorkspaces")}
          </label>
          <p id={`${moveId}-description`} className="mt-0.5 text-[11.5px] leading-[1.125rem] text-zinc-500">
            {moveAcross
              ? tx(locale, "Selected entries move here and are removed from their source workspace.", "Выбранные записи переносятся сюда и удаляются из исходного пространства.")
              : tx(locale, "Off: selected entries are copied here and stay in their source workspace.", "Выкл.: выбранные записи копируются сюда и остаются в исходном пространстве.")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-4">
        <span className="mr-auto text-xs tabular-nums text-zinc-500" aria-live="polite">
          {selectedSourceEntries.length
            ? tx(locale, `${selectedSourceEntries.length} selected`, `Выбрано: ${selectedSourceEntries.length}`)
            : t(locale, "noSelectedEntries")}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSelectedSourceIds(new Set())}
          disabled={!selectedSourceEntries.length}
        >
          {t(locale, "clearSelected")}
        </Button>
        <SubmitButton count={selectedSourceEntries.length} move={moveAcross} locale={locale} />
      </div>
    </form>
  );
}
