import { ArchivedEntriesTable } from "@/components/archived-entries-table";
import { requireUser } from "@/lib/auth";
import { listArchivedItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const items = listArchivedItemsForWorkspace(workspace.id, user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "archiveSection")}
        description={locale === "ru" ? "Архивированные записи скрыты из списков и статистики" : "Archived entries are hidden from lists and stats"}
      />

      <ArchivedEntriesTable
        items={items}
        workspaceId={workspace.id}
        workspaceRole={workspace.accessRole}
        locale={locale}
      />
    </div>
  );
}
