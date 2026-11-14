import { NextResponse } from "next/server";

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
