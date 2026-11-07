"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deleteMessageTemplate, deleteNotificationUnit, saveMessageTemplate, saveNotificationUnit, testMessageTemplate } from "@/lib/notification-center";

async function execute(work: (userId: number) => Promise<unknown> | unknown) {
  const user = await requireUser();
  try {
    const id = await work(user.id);
    revalidatePath("/app/notifications");
    revalidatePath("/app/telegram");
    return { ok: true as const, id: typeof id === "number" ? id : undefined };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not save changes." };
  }
}
export async function saveNotificationUnitAction(input: unknown) { return execute((id) => saveNotificationUnit(id, input)); }
export async function deleteNotificationUnitAction(unitId: number) { return execute((id) => deleteNotificationUnit(id, unitId)); }
export async function saveMessageTemplateAction(input: unknown) { return execute((id) => saveMessageTemplate(id, input)); }
export async function deleteMessageTemplateAction(templateId: number) { return execute((id) => deleteMessageTemplate(id, templateId)); }
export async function testMessageTemplateAction(input: unknown) { return execute((id) => testMessageTemplate(id, input)); }
