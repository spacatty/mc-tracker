import Link from "next/link";
import { FileUp } from "lucide-react";
import { OpenCaptureButton } from "@/components/capture/quick-capture-button";
import { EntriesWorkspace } from "@/components/inspector/entries-workspace";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listItemsForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui/page-header";

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ add?: string; category?: string; workspace?: string; entry?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const categoryId = Number(params.category || 0);
  const selectedCategory = categoryId ? categories.find((category) => category.id === categoryId) : undefined;
  const items = listItemsForWorkspace(workspace.id, user.id).filter((item) => !categoryId || item.categoryId === categoryId);
  const importHref = `/app/import?workspace=${workspace.id}${selectedCategory ? `&category=${selectedCategory.id}` : ""}`;
  const entriesStateKey = [
    workspace.id,
    selectedCategory?.id || "all",
    params.add === "1" ? "add" : "list",
    items.map((item) => `${item.id}:${item.updatedAt}`).join(","),
  ].join("|");

  return (
    <div className="space-y-6">
      <PageHeader
        title={selectedCategory ? selectedCategory.name : t(locale, "entries")}
        description={selectedCategory ? (locale === "ru" ? "Записи категории" : "Entries in this category") : locale === "ru" ? "Все ресурсы" : "All tracked resources"}
        actions={workspace.accessRole !== "viewer" ? (
          <>
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href={importHref}>
                <FileUp className="h-4 w-4" />
                {locale === "ru" ? "Импорт файла" : "Import file"}
              </Link>
            </Button>
            <OpenCaptureButton label={t(locale, "createEntry")} />
          </>
        ) : null}
      />

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
