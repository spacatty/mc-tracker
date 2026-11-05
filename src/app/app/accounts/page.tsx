import { PageHeader } from "@/components/ui/page-header";
import { AccountsManager } from "@/components/vault/vault-managers";
import { requireUser } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { listAccountsForWorkspace, listVendorsForWorkspace } from "@/lib/vault/store";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const accounts = listAccountsForWorkspace(workspace.id, user.id);
  const vendors = listVendorsForWorkspace(workspace.id, user.id);
  const canEdit = workspace.accessRole === "owner" || workspace.accessRole === "editor";

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "ru" ? "Аккаунты" : "Accounts"}
        description={locale === "ru" ? "Логины к поставщикам. Пароли хранятся в зашифрованном виде." : "Logins for your vendors. Credentials are stored encrypted."}
      />
      <AccountsManager workspaceId={workspace.id} accounts={accounts} vendors={vendors} canEdit={canEdit} locale={locale} />
    </div>
  );
}
