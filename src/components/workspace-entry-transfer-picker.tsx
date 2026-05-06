"use client";

import { HelpCircle, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { transferWorkspaceEntriesAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
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
  const suggestions = useMemo(
    () =>
      sameWorkspaceSelected
        ? []
        : sourceEntries
          .filter((entry) => !selectedSourceIds.has(entry.id))
          .filter((entry) => !targetSignatures.has(entrySignature(entry)))
          .filter((entry) => fuzzyMatch(`${entry.name} ${entry.categoryName || ""} ${entry.vendorName || ""} ${entry.accountName || ""}`, query))
          .slice(0, 12),
    [query, sameWorkspaceSelected, selectedSourceIds, sourceEntries, targetSignatures],
  );

  function addEntry(id: number) {
    setSelectedSourceIds((current) => new Set([...current, id]));
    setQuery("");
  }

  function removeSourceEntry(id: number) {
    setSelectedSourceIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  return (
    <form action={transferWorkspaceEntriesAction} className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <input type="hidden" name="targetWorkspaceId" value={targetWorkspaceId} />
      <input type="hidden" name="mode" value={moveAcross ? "move" : "copy"} />
      {[...selectedSourceIds].map((id) => <input key={id} type="hidden" name="entryIds" value={id} />)}

      {!sourceWorkspaces.length ? (
        <p className="text-sm text-zinc-500">{t(locale, "noWorkspacesYet")}</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[minmax(180px,240px)_1fr]">
        <label className="text-xs text-zinc-500">
          {t(locale, "sourceWorkspace")}
          <input type="hidden" name="sourceWorkspaceId" value={sourceWorkspaceId} />
          <Select
            value={String(sourceWorkspaceId)}
            onValueChange={(value) => {
              setSourceWorkspaceId(Number(value || 0));
              setSelectedSourceIds(new Set());
              setQuery("");
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t(locale, "allWorkspaces")}</SelectItem>
              {sourceWorkspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={String(workspace.id)}>
                  {workspace.emoji} {workspace.name}{workspace.id === targetWorkspaceId ? (locale === "ru" ? " (текущее)" : " (current)") : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs text-zinc-500">
          {t(locale, "addEntriesFuzzySearch")}
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "ru" ? "Введите название, аккаунт, вендора, категорию..." : "Type name, account, vendor, category..."} className="pl-9" />
          </div>
        </label>
      </div>
      {sameWorkspaceSelected ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
          {locale === "ru" ? "Выберите другое исходное пространство для добавления записей." : "Choose another source workspace to add entries."}
        </p>
      ) : null}

      {(query || suggestions.length) && sourceWorkspaces.length ? (
        <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-1">
          {suggestions.map((entry) => (
            <button key={entry.id} type="button" onClick={() => addEntry(entry.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10">
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="truncate text-xs text-zinc-500">
                {entry.workspaceEmoji || "📦"} {entry.workspaceName || t(locale, "workspace")} · {entry.categoryName || t(locale, "uncategorized")} · {entry.accountName || entry.vendorName || "-"}
              </span>
              <Plus className="h-4 w-4 text-zinc-500" />
            </button>
          ))}
          {!suggestions.length ? <p className="px-3 py-5 text-center text-sm text-zinc-500">{locale === "ru" ? "Совпадений не найдено." : "No matching entries."}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {selectedSourceEntries.map((entry) => (
          <span key={`source-${entry.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-200">
            <Badge variant="secondary" className="max-w-[220px] truncate">{entry.name}</Badge>
            <Badge variant="secondary">{entry.workspaceEmoji || "📦"} {entry.workspaceName || t(locale, "workspace")}</Badge>
            <Badge variant="secondary">{entry.categoryName || t(locale, "uncategorized")}</Badge>
            <Badge variant="secondary">{entry.accountName || entry.vendorName || "-"}</Badge>
            <button type="button" onClick={() => removeSourceEntry(entry.id)} className="rounded-md p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200" aria-label={`${t(locale, "remove")} ${entry.name}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {!selectedSourceEntries.length ? <p className="text-sm text-zinc-500">{t(locale, "noSelectedEntries")}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{selectedSourceEntries.length} {t(locale, "selected")}</Badge>
          <Button
            type="button"
            size="sm"
            className="border border-zinc-400/20 bg-zinc-500/10 text-zinc-200 hover:bg-zinc-500/20"
            onClick={() => setSelectedSourceIds(new Set())}
            disabled={!selectedSourceEntries.length}
          >
            {t(locale, "clearSelected")}
          </Button>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300">
            <Checkbox checked={moveAcross} onCheckedChange={(next) => setMoveAcross(next === true)} />
            {t(locale, "moveAcrossWorkspaces")}
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-zinc-500 transition hover:text-violet-200" aria-label={locale === "ru" ? "Подсказка по режиму переноса" : "Move behavior help"}>
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-w-xs text-sm text-zinc-300">
                {locale === "ru"
                  ? "Выкл. (по умолчанию): выбранные записи копируются в целевое пространство и остаются в исходном."
                  : "Off (default): selected entries are copied into target workspace and remain in source workspace."}
                <br />
                {locale === "ru"
                  ? "Вкл.: выбранные записи переносятся в целевое пространство и удаляются из исходного."
                  : "On: selected entries are moved to target workspace and removed from source workspace."}
              </PopoverContent>
            </Popover>
          </label>
          <Button
            type="submit"
            className={moveAcross
              ? "border border-amber-300/30 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30"
              : "border border-violet-300/30 bg-violet-500/20 text-violet-50 hover:bg-violet-500/30"}
            disabled={!selectedSourceEntries.length}
          >
            {t(locale, "saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}

