import "server-only";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { getUserAuthByUsername, getUserById, isSetupComplete } from "./db";
import type { User, UserRole } from "./types";

const cookieName = "mc_tracker_session";

function secretKey() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("AUTH_SECRET must be configured in production.");
  }
  return new TextEncoder().encode(secret || "dev-secret-change-me-for-production-mc-tracker");
}

export async function signIn(username: string, password: string, token?: string) {
  const row = getUserAuthByUsername(username);
  if (!row) {
    throw new Error("Invalid username or password.");
  }

  const ok = await bcrypt.compare(password, String(row.password_hash));
  if (!ok) {
    throw new Error("Invalid username or password.");
  }

  if (row.totp_enabled) {
    const result = await verify({ token: String(token || ""), secret: String(row.totp_secret || ""), epochTolerance: 30 });
    const valid = result.valid;
    if (!valid) {
      throw new Error("Google Authenticator code is required.");
    }
  }

  await setSession(Number(row.id));
}

export async function setSession(userId: number) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secretKey());
    const userId = Number(verified.payload.userId);
    return getUserById(userId);
  } catch {
    return null;
  }
}

export async function requireUser() {
  if (!isSetupComplete()) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export function canManageUsers(actor: User, targetRole: UserRole) {
  if (actor.role === "superadmin") return true;
  return actor.role === "admin" && targetRole === "user";
}

export function canSetRole(actor: User, role: UserRole) {
  if (actor.role !== "superadmin") return role === "user";
  return true;
}

export async function createTotpSetup(username: string) {
  const secret = generateSecret();
  const otpAuthUrl = generateURI({ issuer: "MC Tracker", label: username, secret });
  const qr = await QRCode.toDataURL(otpAuthUrl);
  return { secret, qr, otpAuthUrl };
}

export async function verifyTotp(secret: string, token: string) {
  const result = await verify({ token, secret, epochTolerance: 30 });
  return result.valid;
}
