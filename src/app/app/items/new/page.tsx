import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/db";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; workspace?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const workspace = resolveWorkspaceForUser(user.id, Number(params.workspace || 0) || null);
  const target = new URLSearchParams({
    workspace: String(workspace.id),
    add: "1",
  });
  if (params.category) target.set("category", params.category);
  redirect(`/app/items?${target.toString()}`);
}
