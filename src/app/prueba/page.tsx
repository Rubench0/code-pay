"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

// Walking-skeleton page: proves a real $0.01 CoDi charge end to end. Replaced by the counter screen in phase 2.

type ChargeView = {
  id: string;
  kind: "qr" | "push";
  status: "pending" | "paid" | "expired" | "failed";
  late: boolean;
  totalCents: number;
  numRef: string;
  expiresAt: string;
  paidAt: string | null;
  qrString: string | null;
};

const POLL_MS = 2000;
const TEST_AMOUNT_CENTS = 1;

const formatMxn = (cents: number) =>
  (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function TestChargePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [charge, setCharge] = useState<ChargeView | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create(kind: "qr" | "push") {
    setLoading(true);
    setError(null);
    setCharge(null);
    setQrImage(null);
    const response = await fetch("/api/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, baseCents: TEST_AMOUNT_CENTS, tipPercent: 0, ...(kind === "push" ? { phone } : {}) }),
    });
    setLoading(false);
    if (response.status === 401) return router.replace("/login?next=/prueba");
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return setError(data?.error?.message ?? "Error al crear el cobro");
    setCharge(data);
    if (data.qrString) setQrImage(await QRCode.toDataURL(data.qrString, { width: 320, margin: 1 }));
  }

  const chargeId = charge?.id;
  const pending = charge?.status === "pending";

  useEffect(() => {
    if (!chargeId || !pending) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/charges/${chargeId}`, { cache: "no-store" });
      if (response.ok) setCharge(await response.json());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [chargeId, pending]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Prueba de cobro CoDi ({formatMxn(TEST_AMOUNT_CENTS)})</h1>

      <button
        onClick={() => create("qr")}
        disabled={loading}
        className="rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        Cobrar con QR
      </button>

      <div className="flex gap-2">
        <input
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
          placeholder="Celular (10 dígitos)"
          className="flex-1 rounded-lg border px-4 py-3"
        />
        <button
          onClick={() => create("push")}
          disabled={loading || phone.length !== 10}
          className="rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
        >
          Enviar push
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {charge && (
        <section className="flex flex-col items-center gap-4 rounded-xl border p-6 text-center">
          <p className="text-sm text-neutral-500">Cobro #{charge.numRef}</p>
          <p className="text-3xl font-semibold">{formatMxn(charge.totalCents)}</p>
          {charge.status === "pending" && qrImage && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser
            <img src={qrImage} alt="Código QR CoDi" width={320} height={320} />
          )}
          {charge.status === "pending" && charge.kind === "push" && <p>Revisa la notificación en tu banco…</p>}
          {charge.status === "pending" && <p className="text-neutral-500">Esperando pago…</p>}
          {charge.status === "paid" && (
            <p className="w-full rounded-lg bg-green-600 py-6 text-2xl font-semibold text-white">
              Pagado{charge.late ? " (tarde)" : ""}
            </p>
          )}
          {charge.status === "expired" && <p className="text-amber-700">El cobro venció</p>}
          {charge.status === "failed" && <p className="text-red-600">No se pudo crear el cobro</p>}
        </section>
      )}
    </main>
  );
}
