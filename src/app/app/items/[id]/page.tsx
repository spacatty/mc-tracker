import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getItemForWorkspace, resolveWorkspaceForUser } from "@/lib/db";

/** Legacy entry page: entries are viewed and edited in the drawer on /app/items now. */
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
  redirect(`/app/items?workspace=${workspace.id}&entry=${item.id}`);
}
