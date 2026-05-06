import { CategoryManager } from "@/components/category-manager";
import { requireUser } from "@/lib/auth";
import {
  listCategoriesForWorkspace,
  listCategoryNotificationChannelIdsForWorkspace,
  listNotificationChannelsForWorkspace,
  resolveWorkspaceForUser,
} from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const categories = listCategoriesForWorkspace(workspace.id, user.id);
  const channels = listNotificationChannelsForWorkspace(workspace.id, user.id);
  const selectedByCategory = Object.fromEntries(
    categories.map((category) => [category.id, [...listCategoryNotificationChannelIdsForWorkspace(category.id, workspace.id, user.id)]]),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">{locale === "ru" ? "Шаблоны, поля и напоминания" : "Templates, fields, and reminders"}</h1>
      </header>
      <CategoryManager workspaceId={workspace.id} categories={categories} channels={channels} selectedByCategory={selectedByCategory} locale={locale} />
    </div>
  );
}
