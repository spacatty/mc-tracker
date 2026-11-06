import { EntriesWorkspace } from "@/components/inspector/entries-workspace";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listItemsForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";

import { getLocale } from "@/lib/i18n-server";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ add?: string; category?: string; workspace?: string; entry?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const categoryId = Number(params.category || 0);
  const selectedCategory = categoryId ? categories.find((category) => category.id === categoryId) : undefined;
  const items = listItemsForWorkspace(workspace.id, user.id).filter((item) => !categoryId || item.categoryId === categoryId);
  const entriesStateKey = [
    workspace.id,
    selectedCategory?.id || "all",
    params.add === "1" ? "add" : "list",
    items.map((item) => `${item.id}:${item.updatedAt}`).join(","),
  ].join("|");

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <EntriesWorkspace
        tableKey={entriesStateKey}
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
