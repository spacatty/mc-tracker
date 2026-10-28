import Link from "next/link";
import { FileUp, Plus } from "lucide-react";
import { EntriesTable } from "@/components/entries-table";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listItemsForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ add?: string; category?: string; workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const categoryId = Number(params.category || 0);
  const selectedCategory = categoryId ? categories.find((category) => category.id === categoryId) : undefined;
  const items = listItemsForWorkspace(workspace.id, user.id).filter((item) => !categoryId || item.categoryId === categoryId);
  const addHref = `/app/items?workspace=${workspace.id}${selectedCategory ? `&category=${selectedCategory.id}` : ""}&add=1`;
  const importHref = `/app/import?workspace=${workspace.id}${selectedCategory ? `&category=${selectedCategory.id}` : ""}`;
  const entriesStateKey = [
    workspace.id,
    selectedCategory?.id || "all",
    params.add === "1" ? "add" : "list",
    items.map((item) => `${item.id}:${item.updatedAt}`).join(","),
  ].join("|");

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">{selectedCategory ? `${selectedCategory.name} ${locale === "ru" ? "записи" : "entries"}` : locale === "ru" ? "Все ресурсы" : "All tracked resources"}</h1>
        </div>
        {workspace.accessRole !== "viewer" ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href={addHref}>
                <Plus className="h-4 w-4" />
                {t(locale, "createEntry")}
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link href={importHref}>
                <FileUp className="h-4 w-4" />
                {locale === "ru" ? "Импорт пачкой" : "Bulk import"}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <EntriesTable
        key={entriesStateKey}
        items={items}
        categories={categories}
        vendorSuggestions={listVendorSuggestionsForWorkspace(workspace.id, user.id)}
        workspaceId={workspace.id}
        workspaceRole={workspace.accessRole}
        selectedCategoryId={selectedCategory?.id}
        initialAdd={params.add === "1"}
        locale={locale}
      />
    </div>
  );
}
