import { RecordPaymentDialog } from "@/components/invoice-form";
import { InvoiceLog } from "@/components/invoice-log";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listInvoicesForWorkspace, listItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";

import { getLocale } from "@/lib/i18n-server";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const invoices = listInvoicesForWorkspace(workspace.id, user.id);
  const entries = listItemsForWorkspace(workspace.id, user.id);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <InvoiceLog
        invoices={invoices}
        categories={categories}
        locale={locale}
        actions={
          // Keyed by the log size: a successful submit redirects back here with one more invoice,
          // which remounts the dialog closed.
          <RecordPaymentDialog
            key={`${workspace.id}-${invoices.length}`}
            workspaceId={workspace.id}
            entries={entries}
            categories={categories}
            locale={locale}
          />
        }
      />
    </div>
  );
}
