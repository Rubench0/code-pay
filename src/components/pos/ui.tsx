import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMxn(cents: number): string {
  return money.format(cents / 100)
}

export function ScreenHeader({
  title,
  trailing,
}: {
  title: string
  trailing?: React.ReactNode
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Cobro CoDi</p>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {trailing}
    </header>
  )
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground"
    >
      {children}
    </Link>
  )
}

export function Key({
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

export function MoneyRow({
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

export const loginPathForCurrentPage = () =>
  `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
