import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const SESSION_COOKIE = "merchant_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function sign(value: string): string {
  return createHmac("sha256", env.sessionSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Comparing HMACs keeps both sides the same length, so timing reveals nothing about the password.
export function passwordMatches(candidate: string): boolean {
  return safeEqual(sign(`password:${candidate}`), sign(`password:${env.merchantPassword()}`));
}

// The password is part of the signature, so changing MERCHANT_PASSWORD logs everyone out.
function sessionSignature(expiresAt: number): string {
  return sign(`session:${expiresAt}:${env.merchantPassword()}`);
}

export async function startSession(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  (await cookies()).set(SESSION_COOKIE, `${expiresAt}.${sessionSignature(expiresAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return false;
  const [expiresAtText, signature] = raw.split(".");
  const expiresAt = Number(expiresAtText);
  if (!signature || !Number.isInteger(expiresAt) || expiresAt < Date.now() / 1000) return false;
  return safeEqual(signature, sessionSignature(expiresAt));
}
