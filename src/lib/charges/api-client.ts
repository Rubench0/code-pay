import type { ChargeView, CreateChargeRequest } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const FALLBACK_MESSAGE = "Algo salió mal. Intenta de nuevo.";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "Sin conexión. Revisa tu internet.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error?.message ?? FALLBACK_MESSAGE);
  return data as T;
}

export function createCharge(body: CreateChargeRequest): Promise<ChargeView> {
  return request("/api/charges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchCharge(id: string): Promise<ChargeView> {
  return request(`/api/charges/${encodeURIComponent(id)}`);
}

export async function hasMerchantSession(): Promise<boolean> {
  try {
    await request("/api/session");
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}
