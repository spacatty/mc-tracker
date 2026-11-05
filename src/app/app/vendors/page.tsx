import { PageHeader } from "@/components/ui/page-header";
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
    <div className="space-y-6">
      <PageHeader
        title={locale === "ru" ? "Поставщики" : "Vendors"}
        description={locale === "ru" ? "Сервисы, которые вы оплачиваете, и где в них входить" : "The services you pay and where to log in to them"}
      />
      <VendorsManager workspaceId={workspace.id} vendors={vendors} canEdit={canEdit} locale={locale} />
    </div>
  );
}
