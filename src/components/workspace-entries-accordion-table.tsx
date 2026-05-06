"use client";

import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteItemAction } from "@/app/actions";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type WorkspaceEntry = {
  id: number;
  name: string;
  categoryName?: string;
  vendorName?: string;
  accountName?: string;
  createdAt: string;
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

export function WorkspaceEntriesAccordionTable({
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
  const [query, setQuery] = useState("");
  const canDelete = workspaceRole !== "viewer";
  const filtered = useMemo(
    () =>
      entries
        .filter((entry) =>
          fuzzyMatch(`${entry.name} ${entry.categoryName || ""} ${entry.vendorName || ""} ${entry.accountName || ""}`, query),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries, query],
  );

  return (
    <Accordion type="single" collapsible className="rounded-2xl border border-white/10 bg-black/20 px-4">
      <AccordionItem value="workspace-entries" className="border-b-0">
        <AccordionTrigger className="py-3 text-sm">
          {locale === "ru" ? `Записей в пространстве: ${entries.length}` : `Entries already in workspace (${entries.length})`}
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={locale === "ru" ? "Фильтр записей..." : "Filter entries..."}
                className="pl-9"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-xs text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t(locale, "name")}</th>
                    <th className="px-3 py-2 font-medium">{t(locale, "category")}</th>
                    <th className="px-3 py-2 font-medium">{locale === "ru" ? "Аккаунт / вендор" : "Account / vendor"}</th>
                    <th className="px-3 py-2 text-right font-medium">{t(locale, "actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 text-zinc-100">{entry.name}</td>
                      <td className="px-3 py-2 text-zinc-400">{entry.categoryName || t(locale, "uncategorized")}</td>
                      <td className="px-3 py-2 text-zinc-400">{entry.accountName || entry.vendorName || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        {canDelete ? (
                          <form action={deleteItemAction}>
                            <input type="hidden" name="id" value={entry.id} />
                            <input type="hidden" name="workspaceId" value={workspaceId} />
                            <Button type="submit" variant="ghost" size="sm" className="text-red-200 hover:text-red-100">
                              <Trash2 className="h-3.5 w-3.5" />
                              {t(locale, "delete")}
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-zinc-600">{locale === "ru" ? "Только просмотр" : "View only"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                        {locale === "ru" ? "Записи не найдены." : "No entries found."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
