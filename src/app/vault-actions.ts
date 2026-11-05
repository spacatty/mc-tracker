"use server";

import { revalidatePath } from "next/cache";
import { requireUser, verifyTotp } from "@/lib/auth";
import { getUserAuthByUsername, getWorkspaceRole, payEntryForWorkspace } from "@/lib/db";
import {
  deleteAccountForWorkspace,
  deleteVendorForWorkspace,
  getAccountForWorkspace,
  importVendorsFromEntries,
  linkEntryToAccount,
  readAccountCredentials,
  resolveEntryLogin,
  saveAccountForWorkspace,
  saveVendorForWorkspace,
} from "@/lib/vault/store";
import { credentialTwoFactorEnabled, grantCredentialUnlock, hasCredentialUnlock } from "@/lib/vault/two-factor";
import type { CredentialGate, QuickLoginInfo, RevealResult } from "@/lib/vault/types";
import type { User } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

function refresh() {
  revalidatePath("/app/vendors");
  revalidatePath("/app/accounts");
}

function canReveal(workspaceId: number, userId: number) {
  const role = getWorkspaceRole(workspaceId, userId);
  return role === "owner" || role === "editor";
}

async function gateFor(user: User): Promise<CredentialGate> {
  const required = credentialTwoFactorEnabled();
  return {
    required,
    configured: user.totpEnabled,
    unlocked: !required || (user.totpEnabled && (await hasCredentialUnlock(user.id))),
  };
}

export async function getCredentialGateAction(): Promise<CredentialGate> {
  return gateFor(await requireUser());
}

/* Vendors */

export async function saveVendorAction(input: { workspaceId: number; id?: number | null; name: string; url: string; notes: string }): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  try {
    const id = saveVendorForWorkspace(input, input.workspaceId, user.id);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteVendorAction(workspaceId: number, id: number): Promise<Result> {
  const user = await requireUser();
  try {
    deleteVendorForWorkspace(id, workspaceId, user.id);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function importVendorsFromEntriesAction(workspaceId: number): Promise<Result<{ vendors: number; accounts: number }>> {
  const user = await requireUser();
  try {
    const counts = importVendorsFromEntries(workspaceId, user.id);
    refresh();
    return { ok: true, ...counts };
  } catch (error) {
    return failure(error);
  }
}

/* Accounts */

export async function saveAccountAction(input: {
  workspaceId: number;
  id?: number | null;
  vendorId: number | null;
  name: string;
  loginUrl: string;
  login?: string;
  password?: string;
  notes?: string;
}): Promise<Result<{ id: number }>> {
  const user = await requireUser();
  try {
    const id = saveAccountForWorkspace(input, input.workspaceId, user.id);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteAccountAction(workspaceId: number, id: number): Promise<Result> {
  const user = await requireUser();
  try {
    deleteAccountForWorkspace(id, workspaceId, user.id);
    refresh();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Checks one authenticator code and, when it is right, unlocks credentials for a few minutes. */
export async function unlockCredentialsAction(code: string): Promise<Result> {
  const user = await requireUser();
  if (!user.totpEnabled) return { ok: false, error: "Set up Google Authenticator in Settings first." };
  const secret = String(getUserAuthByUsername(user.username)?.totp_secret || "");
  if (!/^\d{6}$/.test(code.trim()) || !(await verifyTotp(secret, code.trim()))) {
    return { ok: false, error: "That code is not valid. Try the current one." };
  }
  await grantCredentialUnlock(user.id);
  return { ok: true };
}

export async function revealCredentialsAction(workspaceId: number, accountId: number, code?: string): Promise<RevealResult> {
  const user = await requireUser();
  if (!canReveal(workspaceId, user.id)) {
    return { ok: false, reason: "forbidden", message: "Only workspace owners and editors can view credentials." };
  }
  if (credentialTwoFactorEnabled()) {
    if (!user.totpEnabled) {
      return { ok: false, reason: "two_factor_not_configured", message: "Credentials need a 2FA code, and your account has no authenticator yet." };
    }
    if (!(await hasCredentialUnlock(user.id))) {
      if (!code) return { ok: false, reason: "two_factor_required", message: "Enter your authenticator code." };
      const unlocked = await unlockCredentialsAction(code);
      if (!unlocked.ok) return { ok: false, reason: "invalid_code", message: unlocked.error };
    }
  }
  try {
    const credentials = readAccountCredentials(accountId, workspaceId);
    if (!credentials) return { ok: false, reason: "not_found", message: "Account not found." };
    return { ok: true, credentials };
  } catch (error) {
    return { ok: false, reason: "not_found", message: error instanceof Error ? error.message : "Credentials could not be read." };
  }
}

/* Quick login from an entry */

export async function getQuickLoginAction(workspaceId: number, itemId: number): Promise<Result<{ info: QuickLoginInfo }>> {
  const user = await requireUser();
  try {
    const resolved = resolveEntryLogin(itemId, workspaceId, user.id);
    if (!resolved) return { ok: false, error: "Entry not found." };
    const role = getWorkspaceRole(workspaceId, user.id);
    return {
      ok: true,
      info: {
        itemId,
        itemName: resolved.item.name,
        vendorName: resolved.account?.vendorName || resolved.item.vendorName || "",
        entryAccountName: resolved.item.accountName || "",
        url: resolved.url,
        account: resolved.account,
        canCreateAccount: !resolved.account && (role === "owner" || role === "editor"),
        canReveal: canReveal(workspaceId, user.id),
        twoFactor: await gateFor(user),
      },
    };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Saves credentials for the account named on an entry, creating the vendor (from the entry's vendor name and URL)
 * and the account when they don't exist yet.
 */
export async function saveEntryCredentialsAction(input: {
  workspaceId: number;
  itemId: number;
  accountName: string;
  login: string;
  password: string;
  loginUrl?: string;
}): Promise<Result<{ accountId: number }>> {
  const user = await requireUser();
  try {
    const resolved = resolveEntryLogin(input.itemId, input.workspaceId, user.id);
    if (!resolved) return { ok: false, error: "Entry not found." };
    let vendorId = resolved.vendorId;
    if (!vendorId && resolved.item.vendorName?.trim()) {
      vendorId = saveVendorForWorkspace({ name: resolved.item.vendorName, url: resolved.item.vendorUrl || "", notes: "" }, input.workspaceId, user.id);
    }
    const accountName = (resolved.account?.name || input.accountName || resolved.item.accountName || "").trim();
    if (!accountName) return { ok: false, error: "Give the account a name." };
    if (!resolved.item.accountName?.trim()) linkEntryToAccount(input.itemId, input.workspaceId, user.id, accountName);
    const existing = resolved.account ? getAccountForWorkspace(resolved.account.id, input.workspaceId, user.id) : null;
    const accountId = saveAccountForWorkspace(
      {
        id: existing?.id,
        vendorId: existing ? existing.vendorId : vendorId,
        name: accountName,
        loginUrl: input.loginUrl ?? existing?.loginUrl ?? "",
        login: input.login,
        password: input.password,
      },
      input.workspaceId,
      user.id,
    );
    // No revalidate here: it would re-render the page under the open panel, which refreshes when it closes.
    return { ok: true, accountId };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Records today's payment from the Quick login panel. Unlike payEntryAction it does not revalidate,
 * because that would re-mount the open panel; the panel refreshes the page when it closes.
 */
export async function quickLoginPayAction(workspaceId: number, itemId: number): Promise<Result> {
  const user = await requireUser();
  try {
    payEntryForWorkspace(itemId, workspaceId, user.id, new Date().toISOString().slice(0, 10));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
