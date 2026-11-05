import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

/**
 * Env switches (both off by default):
 * - TWO_FACTOR_LOGIN=true: offer Google Authenticator setup in Settings and ask for the code at sign-in.
 *   Users who already turned 2FA on keep being asked for it even when this is off.
 * - TWO_FACTOR_CREDENTIALS=true: ask for a fresh authenticator code before account credentials are revealed.
 *   One code unlocks credentials for TWO_FACTOR_CREDENTIALS_TTL_MINUTES (default 5).
 */

function flag(name: string) {
  return /^(1|true|on|yes)$/i.test(process.env[name]?.trim() || "");
}

export function loginTwoFactorEnabled() {
  return flag("TWO_FACTOR_LOGIN");
}

export function credentialTwoFactorEnabled() {
  return flag("TWO_FACTOR_CREDENTIALS");
}

/** The Settings card is shown when either switch needs an authenticator. */
export function twoFactorSetupAvailable() {
  return loginTwoFactorEnabled() || credentialTwoFactorEnabled();
}

function unlockMinutes() {
  const value = Number(process.env.TWO_FACTOR_CREDENTIALS_TTL_MINUTES || 5);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 24 * 60) : 5;
}

const unlockCookie = "mc_tracker_vault_unlock";

function secretKey() {
  const secret = process.env.AUTH_SECRET?.trim() || "dev-secret-change-me-for-production-mc-tracker";
  return new TextEncoder().encode(`${secret}:vault-unlock`);
}

export async function grantCredentialUnlock(userId: number) {
  const minutes = unlockMinutes();
  if (minutes <= 0) return;
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(secretKey());
  const cookieStore = await cookies();
  cookieStore.set(unlockCookie, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: minutes * 60,
  });
}

export async function hasCredentialUnlock(userId: number) {
  const token = (await cookies()).get(unlockCookie)?.value;
  if (!token) return false;
  try {
    const verified = await jwtVerify(token, secretKey());
    return Number(verified.payload.userId) === userId;
  } catch {
    return false;
  }
}

export async function clearCredentialUnlock() {
  (await cookies()).delete(unlockCookie);
}
