import { VendorsManager } from "@/components/vault/vault-managers";
import { requireUser } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { listVendorsForWorkspace } from "@/lib/vault/store";

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const vendors = listVendorsForWorkspace(workspace.id, user.id);
  const canEdit = workspace.accessRole === "owner" || workspace.accessRole === "editor";

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <VendorsManager workspaceId={workspace.id} vendors={vendors} canEdit={canEdit} locale={locale} />
    </div>
  );
}
