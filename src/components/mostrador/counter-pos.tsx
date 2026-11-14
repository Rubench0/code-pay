"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Check, Delete, Smartphone } from "lucide-react"
import { ChargeQr } from "@/components/charge-qr"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ApiError, createCharge, fetchCharge, hasMerchantSession } from "@/lib/charges/api-client"
import type { ChargeView, CreateChargeRequest } from "@/lib/charges/types"
import { cn } from "@/lib/utils"

const LOGIN_PATH = "/login?next=/mostrador"
const POLL_MS = 2000
const MAX_CENTS = 9_999_999
const TIP_PRESETS = [0, 10, 15, 20] as const
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

type TipPreset = (typeof TIP_PRESETS)[number]
type TipChoice = TipPreset | "custom"
type Delivery = "qr" | "push"

type ActiveCharge = {
  view: ChargeView
  request: CreateChargeRequest
  phone: string
}

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatMxn(cents: number): string {
  return money.format(cents / 100)
}

function formatPhone(digits: string): string {
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, "$1 $2 $3")
}

function countdownParts(ms: number): {
  label: string
  name: string
} {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const minuteLabel = minutes === 1 ? "1 minuto" : `${minutes} minutos`
  const secondLabel = seconds === 1 ? "1 segundo" : `${seconds} segundos`
  return {
    label: `${minutes}:${seconds.toString().padStart(2, "0")}`,
    name: `Vence en ${minuteLabel} y ${secondLabel}`,
  }
}

function readTip(
  choice: TipChoice,
  customRaw: string,
): { percent: number | null; error: string | null } {
  if (choice !== "custom") return { percent: choice, error: null }
  if (customRaw === "") {
    return { percent: null, error: "Escribe el porcentaje de propina." }
  }
  if (!/^\d{1,3}$/.test(customRaw)) {
    return { percent: null, error: "Usa un porcentaje del 0 al 100." }
  }
  const percent = Number(customRaw)
  if (percent > 100) {
    return { percent: null, error: "Usa un porcentaje del 0 al 100." }
  }
  return { percent, error: null }
}

function readPhone(digits: string): string | null {
  if (digits.length === 0) return "Escribe los 10 dígitos del celular."
  if (digits.length < 10) return "El celular debe tener 10 dígitos."
  if (!/^[1-9]\d{9}$/.test(digits)) return "El celular no puede empezar con 0."
  return null
}

// Display only: the server computes the amounts it actually charges.
function tipCentsFor(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100)
}

const remainingUntil = (expiresAt: string) => new Date(expiresAt).getTime() - Date.now()

export function CounterPos() {
  const router = useRouter()
  const [amountCents, setAmountCents] = useState(0)
  const [tipChoice, setTipChoice] = useState<TipChoice>(0)
  const [customTip, setCustomTip] = useState("")
  const [phone, setPhone] = useState("")
  const [amountAttempted, setAmountAttempted] = useState(false)
  const [tipAttempted, setTipAttempted] = useState(false)
  const [phoneAttempted, setPhoneAttempted] = useState(false)
  const [active, setActive] = useState<ActiveCharge | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const customTipRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  const { percent, error: tipError } = readTip(tipChoice, customTip)
  const tipCents = percent == null ? 0 : tipCentsFor(amountCents, percent)
  const totalCents = amountCents + tipCents
  const phoneValidation = readPhone(phone)
  const visibleAmountError =
    amountAttempted && amountCents === 0 ? "Captura el monto antes de cobrar." : null
  const visibleTipError =
    tipError != null && (tipAttempted || customTip !== "") ? tipError : null
  const visiblePhoneError =
    phoneValidation != null && (phoneAttempted || phone.length === 10)
      ? phoneValidation
      : null

  const chargeId = active?.view.id
  const status = active?.view.status
  const expiresAt = active?.view.expiresAt

  useEffect(() => {
    hasMerchantSession()
      .then((ok) => {
        if (!ok) router.replace(LOGIN_PATH)
      })
      .catch(() => {})
  }, [router])

  useEffect(() => {
    if (status !== "pending" || !expiresAt) return
    const id = window.setInterval(() => setRemainingMs(remainingUntil(expiresAt)), 250)
    return () => window.clearInterval(id)
  }, [status, expiresAt])

  // The server decides when a charge is paid or expired; the countdown is only a hint.
  useEffect(() => {
    if (status !== "pending" || !chargeId) return
    const id = window.setInterval(async () => {
      try {
        const view = await fetchCharge(chargeId)
        setActive((current) => (current?.view.id === view.id ? { ...current, view } : current))
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) router.replace(LOGIN_PATH)
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [status, chargeId, router])

  function appendDigit(digit: number) {
    // Keys shift into the cents place, so 8250 is shown as $82.50.
    setAmountCents((current) => {
      const next = current * 10 + digit
      return next > MAX_CENTS ? current : next
    })
  }

  function backspace() {
    setAmountCents((current) => Math.floor(current / 10))
  }

  function selectPreset(preset: TipPreset) {
    setTipChoice(preset)
    setTipAttempted(false)
  }

  function selectCustom() {
    setTipChoice("custom")
    setTipAttempted(false)
    requestAnimationFrame(() => customTipRef.current?.focus())
  }

  async function submit(request: CreateChargeRequest, chargePhone: string) {
    setSubmitting(true)
    setFormError(null)
    try {
      const view = await createCharge(request)
      setRemainingMs(remainingUntil(view.expiresAt))
      setActive({ view, request, phone: chargePhone })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(LOGIN_PATH)
        return
      }
      setActive(null)
      setFormError(error instanceof Error ? error.message : "No se pudo crear el cobro.")
    } finally {
      setSubmitting(false)
    }
  }

  function startCharge(delivery: Delivery) {
    setAmountAttempted(true)
    setTipAttempted(true)
    if (delivery === "push") setPhoneAttempted(true)

    const invalidAmount = amountCents <= 0
    const invalidTip = percent == null
    const invalidPhone = delivery === "push" && readPhone(phone) != null
    if (invalidAmount) amountRef.current?.scrollIntoView({ block: "center" })
    else if (invalidTip) tipRef.current?.scrollIntoView({ block: "center" })
    if (invalidAmount || invalidTip || invalidPhone || percent == null || submitting) return

    void submit(
      {
        kind: delivery,
        baseCents: amountCents,
        tipPercent: percent,
        ...(delivery === "push" ? { phone } : {}),
      },
      delivery === "push" ? phone : "",
    )
  }

  function retry() {
    if (active && !submitting) void submit(active.request, active.phone)
  }

  function newCharge() {
    setAmountCents(0)
    setTipChoice(0)
    setCustomTip("")
    setPhone("")
    setAmountAttempted(false)
    setTipAttempted(false)
    setPhoneAttempted(false)
    setFormError(null)
    setActive(null)
  }

  return (
    <main
      lang="es-MX"
      className="flex h-dvh max-h-dvh min-h-0 flex-1 justify-center overflow-hidden bg-[#f4f0e8] text-foreground"
    >
      <div className="h-dvh w-full max-w-md overflow-hidden">
        {active && status === "paid" ? (
          <PaidScreen charge={active.view} onNew={newCharge} />
        ) : active && (status === "expired" || status === "failed") ? (
          <ExpiredScreen
            charge={active.view}
            submitting={submitting}
            error={formError}
            onRetry={retry}
            onNew={newCharge}
          />
        ) : active && status === "pending" ? (
          <PendingScreen charge={active.view} phone={active.phone} remainingMs={remainingMs} />
        ) : (
          <form
            noValidate
            className="flex h-full max-h-full min-h-0 flex-col overflow-hidden"
            onSubmit={(event) => {
              event.preventDefault()
              startCharge("push")
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
              <ScreenHeader
                trailing={
                  <Badge variant="outline" className="h-6 bg-white px-2.5">
                    CoDi
                  </Badge>
                }
              />

              <div ref={amountRef} className="flex shrink-0 flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">Monto</p>
                <p
                  aria-live="polite"
                  className="text-center text-[clamp(2.5rem,12vw,3.5rem)] leading-none font-semibold tracking-tight tabular-nums"
                >
                  {formatMxn(amountCents)}
                </p>
                {visibleAmountError ? (
                  <p className="text-sm text-destructive">{visibleAmountError}</p>
                ) : null}
              </div>

              <div
                role="group"
                aria-label="Teclado numérico"
                className="grid shrink-0 grid-cols-3 gap-1.5"
              >
                {KEYS.map((digit) => (
                  <Key key={digit} onClick={() => appendDigit(digit)}>
                    {digit}
                  </Key>
                ))}
                <Key className="col-span-2" onClick={() => appendDigit(0)}>
                  0
                </Key>
                <Key aria-label="Quitar el último dígito" onClick={backspace}>
                  <Delete className="size-6" />
                </Key>
              </div>

              <div ref={tipRef} className="flex shrink-0 flex-col gap-2">
                <p className="text-sm font-medium">Propina</p>
                <div role="group" aria-label="Propina" className="grid grid-cols-5 gap-1.5">
                  {TIP_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={tipChoice === preset ? "default" : "outline"}
                      aria-pressed={tipChoice === preset}
                      className="h-10 w-full px-0 text-sm"
                      onClick={() => selectPreset(preset)}
                    >
                      {preset} %
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={tipChoice === "custom" ? "default" : "outline"}
                    aria-pressed={tipChoice === "custom"}
                    className="h-10 w-full px-0 text-sm"
                    onClick={selectCustom}
                  >
                    Otra
                  </Button>
                </div>
                {tipChoice === "custom" ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="propina-personalizada" className="text-sm font-medium">
                      Porcentaje
                    </label>
                    <Input
                      ref={customTipRef}
                      id="propina-personalizada"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="12"
                      value={customTip}
                      aria-invalid={visibleTipError ? true : undefined}
                      aria-describedby={visibleTipError ? "propina-error" : undefined}
                      className="h-12 bg-white px-3 text-base"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault()
                      }}
                      onValueChange={(value) => {
                        setCustomTip(value.replace(/\D/g, "").slice(0, 3))
                      }}
                    />
                  </div>
                ) : null}
                {visibleTipError ? (
                  <p id="propina-error" className="text-sm text-destructive">
                    {visibleTipError}
                  </p>
                ) : null}
              </div>

              <Card className="shrink-0 bg-white shadow-none">
                <CardContent className="flex flex-col gap-2">
                  <MoneyRow label="Subtotal" value={formatMxn(amountCents)} />
                  <MoneyRow
                    label={percent == null ? "Propina" : `Propina ${percent} %`}
                    value={formatMxn(tipCents)}
                  />
                  <MoneyRow label="Total" value={formatMxn(totalCents)} emphasis />
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-[#f4f0e8] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
              <Button
                type="button"
                className="h-12 w-full text-base"
                disabled={submitting}
                onClick={() => startCharge("qr")}
              >
                {submitting ? "Creando cobro…" : "Mostrar QR"}
              </Button>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="celular" className="text-sm font-medium">
                  Celular
                </label>
                <Input
                  id="celular"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10 dígitos"
                  value={phone}
                  aria-invalid={visiblePhoneError ? true : undefined}
                  aria-describedby={visiblePhoneError ? "celular-error" : undefined}
                  className="h-12 bg-white px-3 text-base"
                  onValueChange={(value) => {
                    setPhone(value.replace(/\D/g, "").slice(0, 10))
                  }}
                />
                {visiblePhoneError ? (
                  <p id="celular-error" className="text-sm text-destructive">
                    {visiblePhoneError}
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                variant="outline"
                className="h-12 w-full bg-white text-base"
                disabled={submitting}
              >
                Enviar a celular
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}

function ScreenHeader({ trailing }: { trailing?: React.ReactNode }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Cobro CoDi</p>
        <h1 className="text-xl font-semibold tracking-tight">Mostrador</h1>
      </div>
      {trailing}
    </header>
  )
}

function Key({
  children,
  className,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-12 w-full rounded-2xl bg-white text-2xl font-medium shadow-none",
        className,
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  )
}

function MoneyRow({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        emphasis && "border-t border-border pt-2 text-base font-semibold",
      )}
    >
      <span className={emphasis ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function PendingScreen({
  charge,
  phone,
  remainingMs,
}: {
  charge: ChargeView
  phone: string
  remainingMs: number
}) {
  const countdown = countdownParts(remainingMs)
  const urgent = remainingMs <= 60_000
  const overdue = remainingMs <= 0

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ScreenHeader
        trailing={
          <Badge variant="outline" className="h-6 gap-1.5 bg-white px-2.5">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            Pendiente
          </Badge>
        }
      />

      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        <p className="text-sm text-muted-foreground">Cobro #{charge.numRef}</p>
        <p className="text-[clamp(2.25rem,11vw,3.25rem)] leading-none font-semibold tracking-tight tabular-nums">
          {formatMxn(charge.totalCents)}
        </p>
        <p className="text-sm text-muted-foreground">
          Subtotal {formatMxn(charge.baseCents)} · Propina {formatMxn(charge.tipCents)}
        </p>
      </div>

      <Card className="mt-5 bg-white shadow-none">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          {charge.kind === "qr" && charge.qrString ? (
            <>
              <ChargeQr value={charge.qrString} />
              <p className="text-sm text-muted-foreground">
                El cliente lo escanea desde la app de su banco, en CoDi.
              </p>
            </>
          ) : (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Smartphone className="size-8" aria-hidden />
              </div>
              <p className="text-base font-medium">Cobro enviado al {formatPhone(phone)}</p>
              <p className="text-sm text-muted-foreground">
                El cliente lo acepta en la notificación de su banco.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-5 text-center" aria-live="polite">
        {overdue ? (
          <p className="text-base text-muted-foreground">Verificando el pago…</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Vence en</p>
            <p
              role="timer"
              aria-label={countdown.name}
              className={cn(
                "text-4xl font-semibold tabular-nums tracking-tight",
                urgent && "text-amber-700",
              )}
            >
              {countdown.label}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function PaidScreen({ charge, onNew }: { charge: ChargeView; onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#127a45] px-6 py-10 text-center text-white">
      <div className="flex size-20 items-center justify-center rounded-full bg-white/15">
        <Check className="size-10" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-lg font-medium">Pagado · Cobro #{charge.numRef}</h1>
        <p className="text-[clamp(3rem,14vw,4.5rem)] leading-none font-semibold tracking-tight tabular-nums">
          {formatMxn(charge.totalCents)}
        </p>
        {charge.tipCents > 0 ? (
          <p className="text-base text-white/85">
            Incluye {formatMxn(charge.tipCents)} de propina
          </p>
        ) : null}
        {charge.late ? (
          <p className="text-sm text-white/85">El pago llegó después del vencimiento.</p>
        ) : null}
      </div>
      <Button
        type="button"
        className="h-12 w-full max-w-xs bg-white text-base text-[#127a45] hover:bg-white/90"
        onClick={onNew}
      >
        Nuevo cobro
      </Button>
    </div>
  )
}

function ExpiredScreen({
  charge,
  submitting,
  error,
  onRetry,
  onNew,
}: {
  charge: ChargeView
  submitting: boolean
  error: string | null
  onRetry: () => void
  onNew: () => void
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 overflow-y-auto px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Badge variant="destructive" className="h-6 px-2.5">
        Vencido
      </Badge>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">El cobro venció</h1>
        <p className="text-base leading-6 text-muted-foreground">
          Pasaron 6 minutos y no se recibió el pago.
        </p>
      </div>
      <p className="text-4xl font-semibold tracking-tight tabular-nums">
        {formatMxn(charge.totalCents)}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="button" className="h-12 w-full text-base" disabled={submitting} onClick={onRetry}>
          {submitting ? "Creando cobro…" : "Reintentar"}
        </Button>
        <Button type="button" variant="ghost" className="h-12 w-full text-base" onClick={onNew}>
          Nuevo cobro
        </Button>
      </div>
    </div>
  )
}
