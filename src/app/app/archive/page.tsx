import { ArchivedEntriesTable } from "@/components/archived-entries-table";
import { requireUser } from "@/lib/auth";
import { listArchivedItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";


export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const items = listArchivedItemsForWorkspace(workspace.id, user.id);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <ArchivedEntriesTable
        items={items}
        workspaceId={workspace.id}
        workspaceRole={workspace.accessRole}
        locale={locale}
      />
    </div>
  );
}
