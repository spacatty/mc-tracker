import { TableVariants } from "@/components/table-variants";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { listItemsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

/** Temporary preview of five table styles; not linked from the sidebar. */
export default async function TableStylesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const items = listItemsForWorkspace(workspace.id, user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={locale === "ru" ? "Превью" : "Preview"}
        title={locale === "ru" ? "Стили таблиц" : "Table styles"}
        description={locale === "ru" ? "Пять вариантов на ваших записях. Выберите один, и я перенесу его во все таблицы." : "Five takes on your own entries. Pick one and it becomes the style for every table."}
      />
      <TableVariants items={items} locale={locale} />
    </div>
  );
}
