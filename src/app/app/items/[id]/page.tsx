import { notFound } from "next/navigation";
import { ItemForm } from "@/components/item-form";
import { requireUser } from "@/lib/auth";
import { getItemForWorkspace, listCategoriesForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const qs = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(qs.workspace || 0) || null);
  const item = getItemForWorkspace(Number(id), workspace.id, user.id);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">{item.name}</h1>
      </div>
      <ItemForm
        workspaceId={workspace.id}
        item={item}
        categories={listCategoriesForWorkspace(workspace.id, user.id)}
        vendorSuggestions={listVendorSuggestionsForWorkspace(workspace.id, user.id)}
      />
    </div>
  );
}
