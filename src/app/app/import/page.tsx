import Link from "next/link";
import { PencilLine } from "lucide-react";
import { BulkImportPanel } from "@/components/bulk-import-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { aiConfigured, aiModelLabel } from "@/lib/ai/openrouter";
import { listCategoriesForWorkspace, listItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ workspace?: string; category?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const defaultCategoryId = categories.find((category) => category.id === Number(params.category || 0))?.id ?? null;
  const entries = listItemsForWorkspace(workspace.id, user.id).map((item) => ({
    id: item.id,
    name: item.name,
    vendorName: item.vendorName,
    accountName: item.accountName,
    categoryId: item.categoryId,
  }));
  const ru = locale === "ru";
  const configured = aiConfigured();
  const aiLockedReason = !user.premium
    ? (ru ? "AI-разбор свободного текста доступен в Premium. CSV и JSON работают всегда." : "AI parsing of free-form text is a Premium feature. CSV and JSON always work.")
    : !configured
      ? (ru ? "AI не настроен: укажите OPENROUTER_API_KEY (или AI_API_KEY) в .env.local." : "AI is not configured: set OPENROUTER_API_KEY (or AI_API_KEY) in .env.local.")
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={ru ? "Импорт" : "Import"}
        title={ru ? "Добавить записи пачкой" : "Add entries in bulk"}
        description={ru
          ? "Вставьте таблицу, список или счёт — проверьте строки в таблице и подтвердите все сразу."
          : "Paste a spreadsheet, a list or an invoice, review the rows in the grid, and confirm them all at once."}
        actions={workspace.accessRole !== "viewer" ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/app/items?workspace=${workspace.id}${defaultCategoryId ? `&category=${defaultCategoryId}` : ""}&add=1`}>
              <PencilLine className="h-4 w-4" />
              {ru ? "Добавить одну вручную" : "Add one manually"}
            </Link>
          </Button>
        ) : null}
      />
      <BulkImportPanel
        workspaceId={workspace.id}
        categories={categories}
        entries={entries}
        readOnly={workspace.accessRole === "viewer"}
        aiAvailable={user.premium && configured}
        aiLockedReason={aiLockedReason}
        model={aiModelLabel()}
        defaultCategoryId={defaultCategoryId}
        locale={locale}
      />
    </div>
  );
}
