"use client";

import { Crown, Plus, SearchX, UserPlus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { roleLabel, t } from "@/lib/i18n";
import type { Workspace } from "@/lib/types";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { JoinWorkspaceDialog } from "./join-workspace-dialog";
import { Button } from "./ui/button";
import { SearchInput } from "./ui/input";
import { SectionCard } from "./ui/section-card";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, TableToolbar } from "./ui/table";

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

/** Left column of the workspaces page: searchable list; picking a row opens its settings on the right. */
export function WorkspaceList({
  workspaces,
  entryCounts,
  selectedId,
  locale = "en",
}: {
  workspaces: Workspace[];
  entryCounts: Record<number, number>;
  selectedId?: number;
  locale?: Locale;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const visible = workspaces.filter((workspace) =>
    fuzzyMatch(`${workspace.name} ${workspace.emoji} ${workspace.ownerUsername || ""} ${workspace.accessRole}`, query),
  );
  const createLabel = t(locale, "createWorkspace");
  const joinLabel = t(locale, "joinWorkspace");

  /** Only changes which workspace this page shows (`ws`); the user's current workspace (`workspace`) stays. */
  function select(workspaceId: number) {
    const params = new URLSearchParams();
    const current = searchParams.get("workspace");
    if (current) params.set("workspace", current);
    params.set("ws", String(workspaceId));
    router.push(`/app/folders?${params}`);
  }

  return (
    <SectionCard flush className="flex min-h-[18rem] flex-col lg:min-h-0" bodyClassName="flex min-h-0 flex-1 flex-col">
      <TableToolbar
        className="flex-nowrap"
        end={
          <>
            <JoinWorkspaceDialog
              locale={locale}
              trigger={
                <Button type="button" size="icon-sm" variant="secondary" aria-label={joinLabel} title={joinLabel}>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                </Button>
              }
            />
            <CreateWorkspaceDialog
              locale={locale}
              trigger={
                <Button type="button" size="icon-sm" variant="secondary" aria-label={createLabel} title={createLabel}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              }
            />
          </>
        }
      >
        <SearchInput
          size="sm"
          value={query}
          onChange={setQuery}
          placeholder={t(locale, "searchWorkspace")}
          clearLabel={tx(locale, "Clear search", "Очистить поиск")}
          className="min-w-0 flex-1"
        />
      </TableToolbar>
      <Table bare fill>
        <TableHeader>
          <TableRow>
            <TableHead>{tx(locale, "Workspaces", "Пространства")}</TableHead>
            <TableHead align="right">{t(locale, "entries")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((workspace) => {
            const isOwner = workspace.accessRole === "owner";
            return (
              <TableRow
                key={workspace.id}
                interactive
                active={workspace.id === selectedId}
                tabIndex={0}
                onClick={() => select(workspace.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(workspace.id);
                  }
                }}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400/40"
              >
                <TableCell primary>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center text-[14px] leading-none" aria-hidden="true">
                      {workspace.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{workspace.name}</span>
                      <span className="flex items-center gap-1 text-[11.5px] font-normal text-zinc-500">
                        {isOwner ? <Crown className="h-3 w-3 text-amber-300/80" aria-hidden="true" /> : <Users className="h-3 w-3 text-sky-300/80" aria-hidden="true" />}
                        <span className="truncate">
                          {roleLabel(locale, workspace.accessRole)}
                          {!isOwner && workspace.ownerUsername ? ` · ${workspace.ownerUsername}` : ""}
                        </span>
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell align="right" muted className="tabular-nums">
                  {entryCounts[workspace.id] ?? 0}
                </TableCell>
              </TableRow>
            );
          })}
          {!visible.length ? (
            <TableEmpty
              colSpan={2}
              icon={<SearchX />}
              title={workspaces.length ? tx(locale, "No workspaces match", "Нет подходящих пространств") : t(locale, "noWorkspacesYet")}
            />
          ) : null}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

