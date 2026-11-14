"use client"

import QRCode from "qrcode"
import { useEffect, useState } from "react"

export function ChargeQr({ value, size = 224 }: { value: string; size?: number }) {
  const [rendered, setRendered] = useState<{ value: string; src: string } | null>(null)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, { width: size * 2, margin: 1 }).then((src) => {
      if (active) setRendered({ value, src })
    })
    return () => {
      active = false
    }
  }, [value, size])

  if (rendered?.value !== value) {
    return <div aria-hidden className="animate-pulse rounded-lg bg-muted" style={{ width: size, height: size }} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser
    <img src={rendered.src} alt="Código QR de cobro CoDi" width={size} height={size} />
  )
}
