import { notFound } from "next/navigation";
import { ItemForm } from "@/components/item-form";
import { requireUser } from "@/lib/auth";
import { getItemForWorkspace, listCategoriesForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const { id } = await params;
  const qs = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(qs.workspace || 0) || null);
  const item = getItemForWorkspace(Number(id), workspace.id, user.id);
  if (!item) notFound();

  return (
    <ItemForm
      workspaceId={workspace.id}
      item={item}
      categories={listCategoriesForWorkspace(workspace.id, user.id)}
      vendorSuggestions={listVendorSuggestionsForWorkspace(workspace.id, user.id)}
      locale={locale}
    />
  );
}
