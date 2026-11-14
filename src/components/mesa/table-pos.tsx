"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Check, Delete, Minus, Plus } from "lucide-react"
import { ChargeQr } from "@/components/charge-qr"
import {
  formatMxn,
  Key,
  loginPathForCurrentPage,
  MoneyRow,
  NavLink,
  ScreenHeader,
} from "@/components/pos/ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ApiError, createCharge, fetchCharge, hasMerchantSession } from "@/lib/charges/api-client"
import { sanitizeReference, type ChargeView } from "@/lib/charges/types"
import { splitCents } from "@/lib/money"
import { cn } from "@/lib/utils"

const POLL_MS = 2000
const MAX_CENTS = 9_999_999
const MIN_PEOPLE = 2
const MAX_PEOPLE = 10
const TIP_PRESETS = [0, 10, 15, 20] as const
const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
// Leaves room for " 10/10" inside the 24-character reference.
const LABEL_MAX_LENGTH = 17

type Share = {
  baseCents: number
  view: ChargeView | null
  error: string | null
}

type Bill = {
  label: string
  tipPercent: number
  shares: Share[]
}

const shareReference = (label: string, index: number, total: number) =>
  sanitizeReference(`${label} ${index + 1}/${total}`)

// Display only: the server computes what it charges for each share.
const shareTotal = (baseCents: number, tipPercent: number) =>
  baseCents + Math.round((baseCents * tipPercent) / 100)

const isPaid = (share: Share) => share.view?.status === "paid"
const isPending = (share: Share) => share.view?.status === "pending"

export function TablePos() {
  const router = useRouter()
  const [amountCents, setAmountCents] = useState(0)
  const [people, setPeople] = useState(MIN_PEOPLE)
  const [tipPercent, setTipPercent] = useState<number>(0)
  const [label, setLabel] = useState("Mesa 1")
  const [bill, setBill] = useState<Bill | null>(null)
  const [selected, setSelected] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const shares = splitCents(amountCents, people)
  const canSplit = shares.length === people
  const pendingIds = bill?.shares.filter(isPending).map((share) => share.view!.id).join(",") ?? ""

  useEffect(() => {
    hasMerchantSession()
      .then((ok) => {
        if (!ok) router.replace(loginPathForCurrentPage())
      })
      .catch(() => {})
  }, [router])

  useEffect(() => {
    if (!pendingIds) return
    const ids = pendingIds.split(",")
    const id = window.setInterval(async () => {
      try {
        const views = await Promise.all(ids.map((chargeId) => fetchCharge(chargeId)))
        setBill((current) => {
          if (!current) return current
          const byId = new Map(views.map((view) => [view.id, view]))
          return {
            ...current,
            shares: current.shares.map((share) =>
              share.view && byId.has(share.view.id) ? { ...share, view: byId.get(share.view.id)! } : share,
            ),
          }
        })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) router.replace(loginPathForCurrentPage())
      }
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [pendingIds, router])

  async function createShare(
    baseCents: number,
    index: number,
    total: number,
    billLabel: string,
    billTip: number,
  ): Promise<Share> {
    try {
      const view = await createCharge({
        kind: "qr",
        baseCents,
        tipPercent: billTip,
        reference: shareReference(billLabel, index, total),
      })
      return { baseCents, view, error: null }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginPathForCurrentPage())
      }
      return { baseCents, view: null, error: error instanceof Error ? error.message : "No se pudo crear" }
    }
  }

  async function splitBill() {
    if (!canSplit || submitting) return
    setSubmitting(true)
    setFormError(null)
    const billLabel = sanitizeReference(label)?.slice(0, LABEL_MAX_LENGTH) ?? "Mesa"
    // Sequential on purpose: keeps numbering in order and stays gentle with the Pey API.
    const created: Share[] = []
    for (const [index, baseCents] of shares.entries()) {
      created.push(await createShare(baseCents, index, shares.length, billLabel, tipPercent))
    }
    setSubmitting(false)
    if (created.every((share) => share.view === null)) {
      setFormError(created[0]?.error ?? "No se pudo dividir la cuenta.")
      return
    }
    setBill({ label: billLabel, tipPercent, shares: created })
    setSelected(0)
  }

  async function retryShare(index: number) {
    if (!bill || submitting) return
    setSubmitting(true)
    const share = await createShare(bill.shares[index].baseCents, index, bill.shares.length, bill.label, bill.tipPercent)
    setSubmitting(false)
    setBill((current) =>
      current ? { ...current, shares: current.shares.map((s, i) => (i === index ? share : s)) } : current,
    )
  }

  function newBill() {
    setBill(null)
    setAmountCents(0)
    setPeople(MIN_PEOPLE)
    setTipPercent(0)
    setFormError(null)
  }

  return (
    <main
      lang="es-MX"
      className="flex h-dvh max-h-dvh min-h-0 flex-1 justify-center overflow-hidden bg-[#f4f0e8] text-foreground"
    >
      <div className="h-dvh w-full max-w-md overflow-hidden">
        {bill && bill.shares.every(isPaid) ? (
          <TablePaidScreen bill={bill} onNew={newBill} />
        ) : bill ? (
          <ProgressScreen
            bill={bill}
            selected={Math.min(selected, bill.shares.length - 1)}
            submitting={submitting}
            onSelect={setSelected}
            onRetry={retryShare}
            onNew={newBill}
          />
        ) : (
          <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
              <ScreenHeader title="Mesa" trailing={<NavLink href="/mostrador">Mostrador</NavLink>} />

              <div className="flex shrink-0 flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">Total de la cuenta</p>
                <p
                  aria-live="polite"
                  className="text-center text-[clamp(2.5rem,12vw,3.5rem)] leading-none font-semibold tracking-tight tabular-nums"
                >
                  {formatMxn(amountCents)}
                </p>
              </div>

              <div role="group" aria-label="Teclado numérico" className="grid shrink-0 grid-cols-3 gap-1.5">
                {KEYS.map((digit) => (
                  <Key
                    key={digit}
                    onClick={() =>
                      setAmountCents((current) => {
                        const next = current * 10 + digit
                        return next > MAX_CENTS ? current : next
                      })
                    }
                  >
                    {digit}
                  </Key>
                ))}
                <Key
                  className="col-span-2"
                  onClick={() => setAmountCents((current) => (current * 10 > MAX_CENTS ? current : current * 10))}
                >
                  0
                </Key>
                <Key aria-label="Quitar el último dígito" onClick={() => setAmountCents((current) => Math.floor(current / 10))}>
                  <Delete className="size-6" />
                </Key>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3">
                <p className="text-sm font-medium">Personas</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Una persona menos"
                    disabled={people <= MIN_PEOPLE}
                    onClick={() => setPeople((current) => Math.max(MIN_PEOPLE, current - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center text-xl font-semibold tabular-nums" aria-live="polite">
                    {people}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Una persona más"
                    disabled={people >= MAX_PEOPLE}
                    onClick={() => setPeople((current) => Math.min(MAX_PEOPLE, current + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <p className="text-sm font-medium">Propina</p>
                <div role="group" aria-label="Propina" className="grid grid-cols-4 gap-1.5">
                  {TIP_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={tipPercent === preset ? "default" : "outline"}
                      aria-pressed={tipPercent === preset}
                      className="h-10 w-full px-0 text-sm"
                      onClick={() => setTipPercent(preset)}
                    >
                      {preset} %
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1.5">
                <label htmlFor="mesa" className="text-sm font-medium">
                  Mesa
                </label>
                <Input
                  id="mesa"
                  autoComplete="off"
                  value={label}
                  maxLength={LABEL_MAX_LENGTH}
                  className="h-12 bg-white px-3 text-base"
                  onValueChange={(value) => setLabel(value)}
                />
              </div>

              <Card className="shrink-0 bg-white shadow-none">
                <CardContent className="flex flex-col gap-2">
                  <MoneyRow label="Total" value={formatMxn(amountCents)} />
                  <MoneyRow
                    label={`Cada persona (${people})`}
                    value={canSplit ? formatMxn(shareTotal(shares[0], tipPercent)) : "—"}
                    emphasis
                  />
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
                disabled={!canSplit || submitting}
                onClick={splitBill}
              >
                {submitting ? "Creando cobros…" : `Dividir entre ${people} y cobrar`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function ProgressScreen({
  bill,
  selected,
  submitting,
  onSelect,
  onRetry,
  onNew,
}: {
  bill: Bill
  selected: number
  submitting: boolean
  onSelect: (index: number) => void
  onRetry: (index: number) => void
  onNew: () => void
}) {
  const paidCount = bill.shares.filter(isPaid).length
  const current = bill.shares[selected]
  const view = current.view

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <ScreenHeader
        title={bill.label}
        trailing={
          <Badge variant="outline" className="h-6 gap-1.5 bg-white px-2.5" aria-live="polite">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            {paidCount} de {bill.shares.length} pagados
          </Badge>
        }
      />

      <div role="tablist" aria-label="Personas" className="mt-5 grid grid-cols-5 gap-1.5">
        {bill.shares.map((share, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === selected}
            onClick={() => onSelect(index)}
            className={cn(
              "flex h-11 items-center justify-center gap-1 rounded-xl border text-sm font-medium",
              index === selected ? "border-foreground bg-white" : "border-border bg-white/60",
              isPaid(share) && "border-[#127a45] bg-[#127a45] text-white",
            )}
          >
            {isPaid(share) ? <Check className="size-4" aria-hidden /> : null}
            {index + 1}
          </button>
        ))}
      </div>

      <Card className="mt-4 bg-white shadow-none">
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Persona {selected + 1} de {bill.shares.length}
            {view ? ` · Cobro #${view.numRef}` : ""}
          </p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatMxn(view?.totalCents ?? shareTotal(current.baseCents, bill.tipPercent))}
          </p>
          {view?.status === "paid" ? (
            <p className="flex items-center gap-2 text-lg font-medium text-[#127a45]">
              <Check className="size-5" aria-hidden /> Pagado
            </p>
          ) : view?.status === "pending" && view.qrString ? (
            <>
              <ChargeQr value={view.qrString} />
              <p className="text-sm text-muted-foreground">Escanéalo desde la app de tu banco, en CoDi.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-destructive">
                {current.error ?? "Este cobro venció sin pago."}
              </p>
              <Button type="button" className="h-11" disabled={submitting} onClick={() => onRetry(selected)}>
                {submitting ? "Creando cobro…" : "Generar nuevo QR"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-auto flex justify-center pt-6">
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onNew}>
          Cancelar y nueva mesa
        </Button>
      </div>
    </div>
  )
}

function TablePaidScreen({ bill, onNew }: { bill: Bill; onNew: () => void }) {
  const totalCents = bill.shares.reduce((sum, share) => sum + (share.view?.totalCents ?? 0), 0)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#127a45] px-6 py-10 text-center text-white">
      <div className="flex size-20 items-center justify-center rounded-full bg-white/15">
        <Check className="size-10" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-lg font-medium">{bill.label} pagada</h1>
        <p className="text-[clamp(3rem,14vw,4.5rem)] leading-none font-semibold tracking-tight tabular-nums">
          {formatMxn(totalCents)}
        </p>
        <p className="text-base text-white/85">
          {bill.shares.length} personas pagaron su parte con CoDi
        </p>
      </div>
      <Button
        type="button"
        className="h-12 w-full max-w-xs bg-white text-base text-[#127a45] hover:bg-white/90"
        onClick={onNew}
      >
        Nueva mesa
      </Button>
    </div>
  )
}
