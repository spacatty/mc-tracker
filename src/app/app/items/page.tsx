import Link from "next/link";
import { Plus } from "lucide-react";
import { EntriesTable } from "@/components/entries-table";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ category?: string; workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const categoryId = Number(params.category || 0);
  const selectedCategory = categoryId ? categories.find((category) => category.id === categoryId) : undefined;
  const items = listItemsForWorkspace(workspace.id, user.id).filter((item) => !categoryId || item.categoryId === categoryId);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">{selectedCategory ? `${selectedCategory.name} ${locale === "ru" ? "записи" : "entries"}` : locale === "ru" ? "Все ресурсы" : "All tracked resources"}</h1>
        </div>
        <Button asChild variant="secondary" className="gap-2 border-violet-400/20 bg-violet-500/[0.14] text-violet-100 hover:border-violet-300/35 hover:bg-violet-500/[0.24] hover:text-white">
          <Link href={`/app/items/new?workspace=${workspace.id}`}>
            <Plus className="h-4 w-4" />
            {t(locale, "createEntry")}
          </Link>
        </Button>
      </header>

      <EntriesTable
        items={items}
        workspaceId={workspace.id}
        workspaceRole={workspace.accessRole}
        visibleFields={selectedCategory?.fields.filter((field) => field.showInTable) || []}
        showCategory={!selectedCategory}
        locale={locale}
      />
    </div>
  );
}
