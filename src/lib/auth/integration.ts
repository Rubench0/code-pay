import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export type IntegrationAuth = "ok" | "disabled" | "unauthorized";

const digest = (value: string) => createHash("sha256").update(value).digest();

// Server-to-server access for the merchant's own systems. Hashing both sides keeps the comparison
// constant-time regardless of token length.
export function checkIntegrationAuth(request: Request): IntegrationAuth {
  const expected = env.integrationApiKey();
  if (!expected) return "disabled";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) return "unauthorized";
  return timingSafeEqual(digest(token), digest(expected)) ? "ok" : "unauthorized";
}
