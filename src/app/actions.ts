"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiDraftItemSchema, extractPaymentItems, normalizeAiDraft } from "@/lib/ai/payment-extractor";
import { localeCookieName, normalizeLocale } from "@/lib/i18n";
import {
  acceptWorkspaceInvite,
  addWorkspaceMemberByUsername,
  createFolder,
  createInitialSuperadmin,
  createInvoiceForWorkspace,
  createWorkspaceForUser,
  createWorkspaceInvite,
  createUser,
  deleteWorkspaceForUser,
  deleteAllNotificationsForWorkspace,
  deleteItemForWorkspace,
  deleteItemsForWorkspace,
  deleteNotificationForWorkspace,
  deleteReadNotificationsForWorkspace,
  deleteNotificationChannelForWorkspace,
  exportSelectedEntriesForWorkspace,
  exportWorkspaceForUser,
  getUserById,
  importWorkspaceDataForUser,
  listCategoriesForWorkspace,
  listItemsForWorkspace,
  listNotificationChannelsForWorkspace,
  listWorkspacesForUser,
  listVendorSuggestionsForWorkspace,
  markAllNotificationsReadForWorkspace,
  markNotificationReadForWorkspace,
  payEntryForWorkspace,
  removeWorkspaceMember,
  resolveWorkspaceForUser,
  revokeWorkspaceInvite,
  resetUserTotp,
  sendTelegramTest,
  setUserTotpSecret,
  transferWorkspaceEntriesForUser,
  updateFolderContentForUser,
  updateWorkspaceForUser,
  updateWorkspaceMemberRole,
  updateUserPremium,
  updateUserPassword,
  updateUserRole,
  upsertCategoryForWorkspace,
  upsertTelegramChannelForWorkspace,
  upsertItem,
} from "@/lib/db";
import { canManageUsers, canSetRole, clearSession, createTotpSetup, requireUser, setSession, signIn, verifyTotp } from "@/lib/auth";
import type { Category, CategoryField, UserRole, WorkspaceRole } from "@/lib/types";
import { exportWorkspaceOptionsSchema, parseImportPayload } from "@/lib/workspace-export";

function required(value: FormDataEntryValue | null, label: string) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function requirePremium(user: Awaited<ReturnType<typeof requireUser>>) {
  if (!user.premium) {
    throw new Error("Premium is required for AI features.");
  }
}

function resolveWorkspaceId(rawWorkspaceId: FormDataEntryValue | number | null | undefined, userId: number) {
  const requested = typeof rawWorkspaceId === "number" ? rawWorkspaceId : Number(rawWorkspaceId || 0);
  const workspace = resolveWorkspaceForUser(userId, Number.isFinite(requested) && requested > 0 ? requested : null);
  return workspace.id;
}

function normalizeInviteToken(raw: FormDataEntryValue | null) {
  const value = required(raw, "Invite token");
  if (value.includes("/invite/")) {
    const token = value.split("/invite/").pop() || "";
    return token.split(/[?#]/)[0].trim();
  }
  return value.trim();
}

function customFieldAliases(field: CategoryField) {
  return [field.id, field.label, field.label.toLowerCase(), field.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")];
}

function customFieldValueFromDraft(customFields: Record<string, unknown>, field: CategoryField) {
  for (const alias of customFieldAliases(field)) {
    if (Object.prototype.hasOwnProperty.call(customFields, alias)) {
      return customFields[alias];
    }
  }
  return undefined;
}

function setCustomFieldValue(formData: FormData, category: Category, customFields: Record<string, unknown>) {
  category.fields.forEach((field) => {
    const value = customFieldValueFromDraft(customFields, field);
    if (field.type === "checkbox") {
      if (value === true || value === "true" || value === "on" || value === "yes") formData.set(`custom_${field.id}`, "on");
      return;
    }

    if (value !== null && value !== undefined) {
      formData.set(`custom_${field.id}`, String(value));
    }
  });
}

export async function setupAction(formData: FormData) {
  const username = required(formData.get("username"), "Username");
  const password = required(formData.get("password"), "Password");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const userId = await createInitialSuperadmin(username, password);
  await setSession(userId);
  redirect("/app");
}

export async function loginAction(formData: FormData) {
  try {
    await signIn(required(formData.get("username"), "Username"), required(formData.get("password"), "Password"), String(formData.get("token") || ""));
  } catch {
    redirect("/login?error=invalid");
  }
  redirect("/app");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function setLanguageAction(formData: FormData) {
  const locale = normalizeLocale(formData.get("locale"));
  const next = String(formData.get("next") || "/app");
  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next.startsWith("/") ? next : "/app");
}

export async function saveCategoryAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  upsertCategoryForWorkspace(formData, workspaceId, user.id);
  revalidatePath("/app/categories");
  revalidatePath("/app");
  redirect(`/app/categories?workspace=${workspaceId}`);
}

export async function saveItemAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  upsertItem(formData, user.id);
  revalidatePath("/app/items");
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  redirect(`/app/items?workspace=${workspaceId}`);
}

export async function analyzeAiImportAction(input: string, answers?: Record<string, string>, workspaceIdArg?: number) {
  const user = await requireUser();
  requirePremium(user);
  const workspaceId = resolveWorkspaceId(workspaceIdArg || null, user.id);
  return extractPaymentItems({
    input,
    answers,
    categories: listCategoriesForWorkspace(workspaceId, user.id),
    entries: listItemsForWorkspace(workspaceId, user.id),
    vendors: listVendorSuggestionsForWorkspace(workspaceId, user.id),
  });
}

export async function createAiImportItemsAction(draftsJson: string, workspaceIdArg?: number) {
  const user = await requireUser();
  requirePremium(user);
  const workspaceId = resolveWorkspaceId(workspaceIdArg || null, user.id);
  const drafts = z.array(aiDraftItemSchema).parse(JSON.parse(draftsJson)).map(normalizeAiDraft);
  const categories = listCategoriesForWorkspace(workspaceId, user.id);
  let processed = 0;

  drafts.forEach((draft) => {
    if ((draft.action === "edit" || draft.action === "pay") && !draft.targetItemId) {
      throw new Error(`Action ${draft.action} requires an existing entry.`);
    }

    if (draft.action === "pay") {
      const invoiceData = new FormData();
      invoiceData.set("itemId", String(draft.targetItemId));
      if (draft.categoryId) invoiceData.set("categoryId", String(draft.categoryId));
      invoiceData.set("paymentDate", draft.billingStartAt || new Date().toISOString().slice(0, 10));
      if (draft.billingEndAt) invoiceData.set("dueDate", draft.billingEndAt);
      if (draft.period) invoiceData.set("period", draft.period);
      if (draft.customPeriodDays) invoiceData.set("customPeriodDays", String(draft.customPeriodDays));
      invoiceData.set("amount", String(draft.amount));
      invoiceData.set("currency", draft.currency);
      invoiceData.set("vendorName", draft.vendorName);
      invoiceData.set("vendorUrl", draft.vendorUrl);
      invoiceData.set("accountName", draft.accountName);
      invoiceData.set("workspaceId", String(workspaceId));
      if (draft.shiftDates) invoiceData.set("shiftDates", "true");
      if (draft.shiftPaymentPeriod) invoiceData.set("shiftPaymentPeriod", "true");
      createInvoiceForWorkspace(invoiceData, workspaceId, user.id);
      processed += 1;
      return;
    }

    const formData = new FormData();
    if (draft.action === "edit" && draft.targetItemId) {
      formData.set("id", String(draft.targetItemId));
    }
    formData.set("name", draft.name);
    if (draft.categoryId) formData.set("categoryId", String(draft.categoryId));
    formData.set("paymentType", draft.paymentType);
    formData.set("amount", String(draft.amount));
    formData.set("currency", draft.currency);
    if (draft.billingStartAt) formData.set("billingStartAt", draft.billingStartAt);
    if (draft.billingEndAt) formData.set("billingEndAt", draft.billingEndAt);
    if (draft.period) formData.set("period", draft.period);
    if (draft.customPeriodDays) formData.set("customPeriodDays", String(draft.customPeriodDays));
    formData.set("vendorName", draft.vendorName);
    formData.set("vendorUrl", draft.vendorUrl);
    formData.set("accountName", draft.accountName);
    formData.set("workspaceId", String(workspaceId));
    formData.set("notes", draft.notes);

    const category = categories.find((candidate) => candidate.id === draft.categoryId);
    if (category) setCustomFieldValue(formData, category, draft.customFields);

    upsertItem(formData, user.id);
    processed += 1;
  });

  revalidatePath("/app");
  revalidatePath("/app/items");
  revalidatePath("/app/invoices");
  revalidatePath("/app/ai-import");
  return { created: processed };
}

export async function payEntryAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  payEntryForWorkspace(Number(formData.get("id")), workspaceId, user.id, formData.get("paymentDate"));
  revalidatePath("/app");
  revalidatePath("/app/items");
  revalidatePath("/app/invoices");
  revalidatePath("/app/notifications");
}

export async function createInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  createInvoiceForWorkspace(formData, workspaceId, user.id);
  revalidatePath("/app/invoices");
  revalidatePath("/app/items");
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  redirect(`/app/invoices?workspace=${workspaceId}`);
}

export async function deleteItemAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  deleteItemForWorkspace(Number(formData.get("id")), workspaceId, user.id);
  revalidatePath("/app/folders");
  revalidatePath("/app/items");
  revalidatePath("/app");
}

export async function deleteItemsAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  const ids = formData.getAll("ids").map((id) => Number(id));
  deleteItemsForWorkspace(ids, workspaceId, user.id);
  revalidatePath("/app/folders");
  revalidatePath("/app/items");
  revalidatePath("/app");
}

export async function exportSelectedEntriesAction(workspaceIdArg: number, ids: number[]) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(workspaceIdArg, user.id);
  const payload = exportSelectedEntriesForWorkspace(workspaceId, ids, user.id);
  return JSON.stringify(payload, null, 2);
}

export async function exportWorkspaceAction(workspaceIdArg: number, optionsArg: unknown) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(workspaceIdArg, user.id);
  const options = exportWorkspaceOptionsSchema.parse(optionsArg || {});
  const payload = exportWorkspaceForUser(workspaceId, options, user.id);
  return JSON.stringify(payload, null, 2);
}

export async function importWorkspaceAction(workspaceIdArg: number, payloadJson: string) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(workspaceIdArg, user.id);
  const payload = parseImportPayload(payloadJson);
  const result = importWorkspaceDataForUser(workspaceId, payload, user.id);
  revalidatePath("/app");
  revalidatePath("/app/items");
  revalidatePath("/app/folders");
  revalidatePath("/app/settings");
  return result;
}

export async function createUserAction(formData: FormData) {
  const actor = await requireUser();
  const role = String(formData.get("role") || "user") as UserRole;
  if (!canSetRole(actor, role)) throw new Error("You cannot create that role.");
  await createUser(required(formData.get("username"), "Username"), required(formData.get("password"), "Password"), role);
  revalidatePath("/app/admin");
}

export async function updateUserPasswordAction(formData: FormData) {
  const actor = await requireUser();
  const target = getUserById(Number(formData.get("userId")));
  if (!target || !canManageUsers(actor, target.role)) throw new Error("You cannot manage that user.");
  await updateUserPassword(target.id, required(formData.get("password"), "Password"));
  revalidatePath("/app/admin");
}

export async function updateUserRoleAction(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== "superadmin") throw new Error("Only superadmin can edit roles.");
  updateUserRole(Number(formData.get("userId")), String(formData.get("role") || "user") as UserRole);
  revalidatePath("/app/admin");
}

export async function updateUserPremiumAction(formData: FormData) {
  const actor = await requireUser();
  const target = getUserById(Number(formData.get("userId")));
  if (!target || !canManageUsers(actor, target.role)) throw new Error("You cannot manage that user.");
  updateUserPremium(target.id, String(formData.get("premium") || "0") === "1");
  revalidatePath("/app/admin");
}

export async function saveUserAdminChangesAction(formData: FormData) {
  const actor = await requireUser();
  const target = getUserById(Number(formData.get("userId")));
  if (!target || !canManageUsers(actor, target.role)) throw new Error("You cannot manage that user.");

  const nextPremium = String(formData.get("premium") || "0") === "1";
  const nextRole = String(formData.get("role") || target.role) as UserRole;
  const nextPassword = String(formData.get("password") || "").trim();
  const resetTotpNow = formData.get("resetTotpNow") === "on";

  if (nextRole !== target.role) {
    if (actor.role !== "superadmin") throw new Error("Only superadmin can edit roles.");
    if (!canSetRole(actor, nextRole)) throw new Error("You cannot set that role.");
    updateUserRole(target.id, nextRole);
  }

  if (nextPremium !== target.premium) {
    updateUserPremium(target.id, nextPremium);
  }

  if (nextPassword) {
    await updateUserPassword(target.id, nextPassword);
  }

  if (resetTotpNow) {
    resetUserTotp(target.id);
  }

  revalidatePath("/app/admin");
}

export async function resetUserTotpAction(formData: FormData) {
  const actor = await requireUser();
  const target = getUserById(Number(formData.get("userId")));
  if (!target || !canManageUsers(actor, target.role)) throw new Error("You cannot manage that user.");
  resetUserTotp(target.id);
  revalidatePath("/app/admin");
}

export async function enableTotpAction(formData: FormData) {
  const user = await requireUser();
  const secret = required(formData.get("secret"), "Secret");
  const token = required(formData.get("token"), "Authenticator code");
  if (!(await verifyTotp(secret, token))) throw new Error("Invalid Google Authenticator code.");
  setUserTotpSecret(user.id, secret, true);
  revalidatePath("/app/settings");
}

export async function disableMyTotpAction() {
  const user = await requireUser();
  resetUserTotp(user.id);
  revalidatePath("/app/settings");
}

export async function getTotpSetupAction() {
  const user = await requireUser();
  return createTotpSetup(user.username);
}

export async function createFolderAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = createWorkspaceForUser(user.id, required(formData.get("name"), "Workspace name"), String(formData.get("emoji") || "📦"));
  if (formData.getAll("itemIds").length || formData.getAll("categoryIds").length) {
    createFolder(
      required(formData.get("name"), "Folder name"),
      user.id,
      formData.getAll("itemIds").map(Number),
      formData.getAll("categoryIds").map(Number),
    );
  }
  revalidatePath("/app/folders");
  redirect(`/app/folders?workspace=${workspaceId}`);
}

export async function updateFolderContentAction(formData: FormData) {
  const user = await requireUser();
  updateFolderContentForUser(formData, user.id);
  revalidatePath("/app/folders");
}

export async function addFolderMemberAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = Number(formData.get("workspaceId"));
  const role = String(formData.get("role") || "viewer") as Exclude<WorkspaceRole, "owner">;
  addWorkspaceMemberByUsername(workspaceId, required(formData.get("username"), "Username"), role, user.id);
  revalidatePath("/app/folders");
}

export async function createInviteAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = Number(formData.get("workspaceId"));
  const token = createWorkspaceInvite(workspaceId, String(formData.get("role") || "viewer") as Exclude<WorkspaceRole, "owner">, user.id);
  revalidatePath("/app/folders");
  redirect(`/app/folders?invite=${token}&workspace=${workspaceId}`);
}

export async function acceptInviteAction(formData: FormData) {
  const user = await requireUser();
  acceptWorkspaceInvite(normalizeInviteToken(formData.get("token")), user.id);
  revalidatePath("/app/folders");
  redirect("/app/folders");
}

export async function updateWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = Number(formData.get("workspaceId"));
  updateWorkspaceForUser(workspaceId, user.id, {
    name: String(formData.get("name") || ""),
    emoji: String(formData.get("emoji") || ""),
  });
  revalidatePath("/app/folders");
  revalidatePath("/app");
}

export async function deleteWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = Number(formData.get("workspaceId"));
  deleteWorkspaceForUser(workspaceId, user.id);
  revalidatePath("/app/folders");
  revalidatePath("/app");
  redirect("/app/folders");
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const user = await requireUser();
  updateWorkspaceMemberRole(
    Number(formData.get("workspaceId")),
    Number(formData.get("targetUserId")),
    String(formData.get("role") || "viewer") as Exclude<WorkspaceRole, "owner">,
    user.id,
  );
  revalidatePath("/app/folders");
  revalidatePath("/app");
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  const user = await requireUser();
  removeWorkspaceMember(Number(formData.get("workspaceId")), Number(formData.get("targetUserId")), user.id);
  revalidatePath("/app/folders");
  revalidatePath("/app");
}

export async function revokeWorkspaceInviteAction(formData: FormData) {
  const user = await requireUser();
  revokeWorkspaceInvite(Number(formData.get("workspaceId")), required(formData.get("token"), "Invite token"), user.id);
  revalidatePath("/app/folders");
}

export async function transferWorkspaceEntriesAction(formData: FormData) {
  const user = await requireUser();
  const sourceWorkspaceId = Number(formData.get("sourceWorkspaceId"));
  const targetWorkspaceId = Number(formData.get("targetWorkspaceId"));
  const mode = String(formData.get("mode") || "copy") as "copy" | "move";
  const entryIds = formData.getAll("entryIds").map((value) => Number(value));
  const removeEntryIds = formData.getAll("removeEntryIds").map((value) => Number(value));
  if (removeEntryIds.length) {
    deleteItemsForWorkspace(removeEntryIds, targetWorkspaceId, user.id);
  }
  if (entryIds.length) {
    if (sourceWorkspaceId > 0) {
      transferWorkspaceEntriesForUser(sourceWorkspaceId, targetWorkspaceId, entryIds, mode, user.id);
    } else {
      const targetEntryIdSet = new Set(entryIds);
      const accessibleSourceWorkspaces = listWorkspacesForUser(user.id).filter((workspace) => workspace.id !== targetWorkspaceId);
      for (const workspace of accessibleSourceWorkspaces) {
        const fromWorkspaceIds = listItemsForWorkspace(workspace.id, user.id)
          .map((item) => item.id)
          .filter((id) => targetEntryIdSet.has(id));
        if (fromWorkspaceIds.length) {
          transferWorkspaceEntriesForUser(workspace.id, targetWorkspaceId, fromWorkspaceIds, mode, user.id);
        }
      }
    }
  }
  revalidatePath("/app/folders");
  revalidatePath("/app/items");
  revalidatePath("/app");
  revalidatePath("/app/notifications");
  redirect(`/app/folders?workspace=${targetWorkspaceId}`);
}

export async function saveTelegramChannelAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  upsertTelegramChannelForWorkspace(formData, workspaceId, user.id);
  revalidatePath("/app/settings");
  revalidatePath("/app/categories");
}

export async function deleteNotificationChannelAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  deleteNotificationChannelForWorkspace(Number(formData.get("id")), workspaceId, user.id);
  revalidatePath("/app/settings");
  revalidatePath("/app/categories");
}

export async function sendTelegramTestAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  const channelId = Number(formData.get("id"));
  const allowed = listNotificationChannelsForWorkspace(workspaceId, user.id).some((channel) => channel.id === channelId);
  if (!allowed) throw new Error("Channel is not accessible in this workspace.");
  await sendTelegramTest(channelId);
  revalidatePath("/app/settings");
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  markNotificationReadForWorkspace(Number(formData.get("id")), workspaceId, user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  markAllNotificationsReadForWorkspace(workspaceId, user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function deleteNotificationAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  deleteNotificationForWorkspace(Number(formData.get("id")), workspaceId, user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function deleteReadNotificationsAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  deleteReadNotificationsForWorkspace(workspaceId, user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function deleteAllNotificationsAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = resolveWorkspaceId(formData.get("workspaceId"), user.id);
  deleteAllNotificationsForWorkspace(workspaceId, user.id);
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}
