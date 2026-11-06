import { CategoryManager } from "@/components/category-manager";
import { requireUser } from "@/lib/auth";
import {
  listCategoriesForWorkspace,
  listCategoryNotificationChannelIdsForWorkspace,
  listNotificationChannelsForWorkspace,
  resolveWorkspaceForUser,
} from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ workspace?: string; category?: string; new?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const channels = listNotificationChannelsForWorkspace(workspace.id, user.id);
  const selectedByCategory = Object.fromEntries(
    categories.map((category) => [category.id, [...listCategoryNotificationChannelIdsForWorkspace(category.id, workspace.id, user.id)]]),
  );
  // `?new=1` (the sidebar "+") opens the empty form; `?category=` (after a save) keeps the edited one open.
  const requested = Number(params.category || 0);
  const initialSelected = params.new === "1" ? "new" : categories.some((category) => category.id === requested) ? requested : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <CategoryManager
        key={`${workspace.id}-${params.new || ""}-${requested || ""}`}
        workspaceId={workspace.id}
        categories={categories}
        channels={channels}
        selectedByCategory={selectedByCategory}
        initialSelected={initialSelected}
        locale={locale}
      />
    </div>
  );
}
