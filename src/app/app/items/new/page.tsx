import { ItemForm } from "@/components/item-form";
import { requireUser } from "@/lib/auth";
import { listCategoriesForWorkspace, listVendorSuggestionsForWorkspace, resolveWorkspaceForUser } from "@/lib/db";

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Add resource, service, or payment</h1>
      </div>
      <ItemForm
        workspaceId={workspace.id}
        categories={listCategoriesForWorkspace(workspace.id, user.id)}
        vendorSuggestions={listVendorSuggestionsForWorkspace(workspace.id, user.id)}
      />
    </div>
  );
}
