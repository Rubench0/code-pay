"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { CobiMark } from "@/components/pos/ui";

function safeNext(value: string | null): string {
  // Only same-site paths, to avoid open redirects.
  return value && /^\/(?![/\\])/.test(value) ? value : "/mostrador";
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (response.ok) router.replace(next);
    else setError("Contraseña incorrecta");
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="mb-4 flex flex-col gap-2">
        <CobiMark className="text-3xl [&>span]:size-10 [&>span]:rounded-xl [&>span]:text-xl" />
        <p className="text-lg text-muted-foreground">Cobi cobra con CoDi por ti.</p>
      </div>
      <h1 className="text-2xl font-bold">Entrar al comercio</h1>
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Contraseña"
        className="rounded-xl border border-input bg-white px-4 py-3"
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
