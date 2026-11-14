import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkIntegrationAuth } from "@/lib/auth/integration";
import { getCharge } from "@/lib/charges/service";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/integrations/charges/[id]">) {
  const auth = checkIntegrationAuth(request);
  if (auth === "disabled") return jsonError(404, "not_found", "Not found");
  if (auth === "unauthorized") return jsonError(401, "unauthorized", "Invalid integration key");

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "not_found", "Charge not found");

  const charge = await getCharge(id);
  if (!charge) return jsonError(404, "not_found", "Charge not found");
  return NextResponse.json(charge, { headers: { "Cache-Control": "no-store" } });
}
