import { NextResponse } from "next/server";
import { z } from "zod";
import { endSession, hasSession, passwordMatches, startSession } from "@/lib/auth/session";
import { jsonError, readJson } from "@/lib/http";

const loginBody = z.object({ password: z.string().min(1).max(200) });

export async function GET() {
  if (!(await hasSession())) return jsonError(401, "unauthorized", "Inicia sesión");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = loginBody.safeParse(await readJson(request));
  if (!parsed.success || !passwordMatches(parsed.data.password)) {
    return jsonError(401, "invalid_credentials", "Contraseña incorrecta");
  }
  await startSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
