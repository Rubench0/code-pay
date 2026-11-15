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
        <CobiMark />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {trailing}
    </header>
  )
}

export function CobiMark({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-bold text-primary", className)}>
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground"
      >
        C
      </span>
      Cobi
    </p>
  )
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-border bg-white px-4 py-2 text-sm font-bold text-foreground"
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
