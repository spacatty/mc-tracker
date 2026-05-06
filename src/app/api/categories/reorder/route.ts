import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { reorderCategoriesForWorkspace, resolveWorkspaceForUser } from "@/lib/db";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as { ids?: number[]; workspaceId?: number };
  const workspaceId = resolveWorkspaceForUser(user.id, Number(body.workspaceId || 0) || null).id;
  reorderCategoriesForWorkspace((body.ids || []).map(Number), workspaceId, user.id);
  return NextResponse.json({ ok: true });
}
