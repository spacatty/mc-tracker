import { Archive } from "lucide-react";
import { ArchivedEntriesTable } from "@/components/archived-entries-table";
import { requireUser } from "@/lib/auth";
import { listArchivedItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const items = listArchivedItemsForWorkspace(workspace.id, user.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-500/10 text-zinc-300">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{t(locale, "archiveSection")}</h1>
            <p className="text-sm text-zinc-500">
              {locale === "ru" ? "Архивированные записи скрыты из списков и статистики" : "Archived entries are hidden from lists and stats"}
            </p>
          </div>
        </div>
      </header>

      <ArchivedEntriesTable
        items={items}
        workspaceId={workspace.id}
        workspaceRole={workspace.accessRole}
        locale={locale}
      />
    </div>
  );
}
