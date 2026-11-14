import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasSession } from "@/lib/auth/session";
import { getCharge } from "@/lib/charges/service";
import { jsonError } from "@/lib/http";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/charges/[id]">) {
  if (!(await hasSession())) return jsonError(401, "unauthorized", "Inicia sesión");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "not_found", "Cobro no encontrado");

  const charge = await getCharge(id);
  if (!charge) return jsonError(404, "not_found", "Cobro no encontrado");
  return NextResponse.json(charge, { headers: { "Cache-Control": "no-store" } });
}
