import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOfferCountdown } from '../hooks/useOfferCountdown.ts'
import { createCheckoutSession, type PackageId } from '../lib/checkout.ts'
import { getDailySoldKeysCount } from '../lib/daily-sold-keys.ts'
import { CustomerReviews } from '../components/CustomerReviews.tsx'
import { ShopFaq } from '../components/ShopFaq.tsx'

interface ProductCardData {
  packageId: PackageId
  title: string
  originalPrice: string
  salePrice: string
  savingsLabel: string
  badge?: string
  features: string[]
  compatible: string
  firmwareNote?: string
  infoNote?: string
}

const PRODUCTS: ProductCardData[] = [
  {
    packageId: 1,
    title: 'G30D / G2D / F2 Serie',
    originalPrice: '89,95€',
    salePrice: '49,95€',
    savingsLabel: 'SPARE 44%',
    badge: 'BESTSELLER 🏆',
    features: [
      '✓ Bis 35 km/h',
      '✓ Cruise Control',
      '✓ Sport Mode',
      '✓ KERS Config',
    ],
    compatible: 'G30D, G30D II, G2D, F2, F2 Plus, F2 Pro',
    firmwareNote: 'DRV unter 1.7.4 erforderlich',
  },
  {
    packageId: 2,
    title: 'F3 Serie',
    originalPrice: '89,95€',
    salePrice: '49,95€',
    savingsLabel: 'SPARE 44%',
    features: ['✓ Bis 35 km/h', '✓ Cruise Control', '✓ Sport Mode'],
    compatible: 'F3, F3D, F3 Pro, F3E',
  },
  {
    packageId: 3,
    title: 'Max G3 Serie',
    originalPrice: '99,95€',
    salePrice: '59,95€',
    savingsLabel: 'SPARE 40%',
    badge: 'NEU 🆕',
    features: ['✓ Bis 45 km/h', '✓ BLE-Konfiguration', '✓ Cruise Control'],
    compatible: 'Max G3, Max G3E, Max G3D',
    infoNote: 'Tuning aktiv bis zum nächsten Neustart',
  },
  {
    packageId: 4,
    title: 'ZT3 / GT3 Serie',
    originalPrice: '99,95€',
    salePrice: '59,95€',
    savingsLabel: 'SPARE 40%',
    features: ['✓ Bis 40 km/h', '✓ BLE-Konfiguration', '✓ Sport Mode'],
    compatible: 'ZT3, ZT3 Pro, GT3, GT3 Pro D',
  },
]

const COMPAT_MODELS: { value: string; label: string; packageId: PackageId; drvMax?: string }[] = [
  { value: 'g30d', label: 'Ninebot G30D', packageId: 1, drvMax: '1.7.3' },
  { value: 'g30d2', label: 'Ninebot G30D II', packageId: 1, drvMax: '1.7.3' },
  { value: 'g2d', label: 'Ninebot G2D', packageId: 1, drvMax: '1.7.3' },
  { value: 'f2', label: 'Ninebot F2', packageId: 1 },
  { value: 'f2plus', label: 'F2 Plus', packageId: 1 },
  { value: 'f2pro', label: 'F2 Pro', packageId: 1 },
  { value: 'f3', label: 'Ninebot F3', packageId: 2 },
  { value: 'f3d', label: 'F3D', packageId: 2 },
  { value: 'f3pro', label: 'F3 Pro', packageId: 2 },
  { value: 'f3e', label: 'F3E', packageId: 2 },
  { value: 'g3', label: 'Max G3', packageId: 3 },
  { value: 'g3e', label: 'Max G3E', packageId: 3 },
  { value: 'g3d', label: 'Max G3D', packageId: 3 },
  { value: 'zt3', label: 'ZT3', packageId: 4 },
  { value: 'zt3pro', label: 'ZT3 Pro', packageId: 4 },
  { value: 'gt3', label: 'GT3', packageId: 4 },
  { value: 'gt3prod', label: 'GT3 Pro D', packageId: 4 },
]

const NAVEE_COMING = ['GT3', 'ST3', 'N65i Serie']

const TRUST_ITEMS = [
  '🔒 SSL-verschlüsselt',
  '⚡ Sofortiger digitaler Versand',
  '🔄 Reversibel – jederzeit zurücksetzbar',
  '✅ Geld-zurück-Garantie (14 Tage)',
]

function parseVersionParts(version: string): number[] {
  return version
    .trim()
    .replace(/[^\d.]/g, '')
    .split('.')
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10) || 0)
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersionParts(a)
  const pb = parseVersionParts(b)
  const len = Math.max(pa.length, pb.length)

  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) {
      return diff
    }
  }

  return 0
}

function ProductCard({
  product,
  loading,
  onBuy,
}: {
  product: ProductCardData
  loading: boolean
  onBuy: () => void
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-surface-elevated p-6 shadow-[0_0_40px_rgba(0,212,255,0.04)] transition-all duration-300 hover:border-accent/30 hover:shadow-[0_0_32px_rgba(0,212,255,0.08)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">{product.title}</h3>
        {product.badge && (
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            {product.badge}
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted">
          <span className="mr-2 text-lg text-muted line-through">{product.originalPrice}</span>
          <span className="text-3xl font-bold text-accent">{product.salePrice}</span>
        </p>
        <p className="mt-1 inline-block rounded-md bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
          {product.savingsLabel}
        </p>
      </div>

      <ul className="mb-4 space-y-1.5 text-sm text-foreground/90">
        {product.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <p className="mb-4 text-xs leading-relaxed text-muted">
        <span className="text-foreground/80">Kompatibel:</span> {product.compatible}
      </p>

      {product.firmwareNote && (
        <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          ⚠️ Firmware-Hinweis: „{product.firmwareNote}“
        </p>
      )}

      {product.infoNote && (
        <p className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
          ℹ️ Hinweis: „{product.infoNote}“
        </p>
      )}

      <button
        type="button"
        onClick={onBuy}
        disabled={loading}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 py-3 text-sm font-semibold text-accent transition-all duration-300 hover:bg-accent/20 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Weiterleitung…
          </>
        ) : (
          'Jetzt freischalten →'
        )}
      </button>
    </article>
  )
}

export default function Shop() {
  const countdown = useOfferCountdown()
  const dailySoldKeys = useMemo(() => getDailySoldKeysCount(), [])
  const [loadingId, setLoadingId] = useState<PackageId | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const [compatModel, setCompatModel] = useState('')
  const [compatVersion, setCompatVersion] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSent, setWaitlistSent] = useState(false)
  const [legalConsentAccepted, setLegalConsentAccepted] = useState(false)
  const [agbToastVisible, setAgbToastVisible] = useState(false)
  const [agbHighlight, setAgbHighlight] = useState(false)
  const agbConsentRef = useRef<HTMLLabelElement>(null)

  useEffect(() => {
    if (!agbToastVisible) {
      return
    }

    const timeoutId = window.setTimeout(() => setAgbToastVisible(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [agbToastVisible])

  const showAgbValidation = () => {
    setAgbToastVisible(true)
    setAgbHighlight(true)
    agbConsentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    window.setTimeout(() => setAgbHighlight(false), 2000)
  }

  const compatResult = useMemo(() => {
    if (!compatModel) {
      return null
    }

    const entry = COMPAT_MODELS.find((item) => item.value === compatModel)
    if (!entry) {
      return { ok: false, message: 'Modell nicht in der Datenbank.' }
    }

    const product = PRODUCTS.find((item) => item.packageId === entry.packageId)
    if (!product) {
      return { ok: false, message: 'Kein passendes Paket gefunden.' }
    }

    if (entry.drvMax && compatVersion.trim()) {
      if (compareVersions(compatVersion.trim(), entry.drvMax) > 0) {
        return {
          ok: false,
          message: `DRV-Version zu hoch — für ${entry.label} wird DRV ≤ ${entry.drvMax} empfohlen (Hinweis: unter 1.7.4).`,
          product,
        }
      }
    }

    if (!compatVersion.trim()) {
      return {
        ok: true,
        message: `Kompatibel mit „${product.title}“. Bitte noch DRV-Version prüfen.`,
        product,
      }
    }

    return {
      ok: true,
      message: `✅ Kompatibel — Paket „${product.title}“ (${product.salePrice}).`,
      product,
    }
  }, [compatModel, compatVersion])

  const handleCheckout = async (packageId: PackageId) => {
    if (!legalConsentAccepted) {
      showAgbValidation()
      return
    }

    setCheckoutError(null)
    setLoadingId(packageId)

    try {
      const { checkoutUrl } = await createCheckoutSession(packageId, {
        legalConsentAccepted: true,
      })
      window.location.href = checkoutUrl
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout fehlgeschlagen')
      setLoadingId(null)
    }
  }

  const handleWaitlist = (event: React.FormEvent) => {
    event.preventDefault()
    if (!waitlistEmail.trim()) {
      return
    }

    const list = JSON.parse(localStorage.getItem('navee-waitlist') ?? '[]') as string[]
    if (!list.includes(waitlistEmail.trim())) {
      list.push(waitlistEmail.trim())
      localStorage.setItem('navee-waitlist', JSON.stringify(list))
    }

    setWaitlistSent(true)
  }

  return (
    <div className="animate-fade-in">
      {agbToastVisible && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl border border-orange-500/50 bg-red-950/95 px-4 py-3 text-center text-sm font-medium text-orange-100 shadow-lg shadow-red-950/40"
        >
          Bitte akzeptiere zuerst die AGB, um fortzufahren.
        </div>
      )}

      <section className="border-b border-border bg-gradient-to-b from-accent/5 to-transparent px-4 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            🛴 Scooter Unlock – Tuning Keys
          </h1>
          <p className="mt-3 text-lg text-muted">
            Schalte das volle Potenzial deines Scooters frei
          </p>

          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
            ⚡ Zeitlich begrenztes Angebot – Spare bis zu 44%
          </div>

          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-3">
            <div
              className="flex gap-2 font-mono-tech text-2xl font-bold text-foreground"
              aria-live="polite"
            >
              <CountdownUnit label="Std" value={countdown.hours} />
              <span className="text-accent">:</span>
              <CountdownUnit label="Min" value={countdown.minutes} />
              <span className="text-accent">:</span>
              <CountdownUnit label="Sek" value={countdown.seconds} />
            </div>
            {countdown.expired && (
              <span className="text-xs text-amber-400">Angebot endet bald — sichere dir den Preis!</span>
            )}
          </div>

          <p className="mt-6 text-sm font-medium text-foreground/90">
            🔥 {dailySoldKeys} Keys heute verkauft
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        {checkoutError && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {checkoutError}
          </div>
        )}

        <label
          ref={agbConsentRef}
          className={[
            'mb-8 flex cursor-pointer gap-3 rounded-xl border bg-surface-elevated p-4 transition-colors',
            agbHighlight ? 'agb-consent-pulse border-red-500' : 'border-border',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={legalConsentAccepted}
            onChange={(event) => {
              setLegalConsentAccepted(event.target.checked)
              if (event.target.checked) {
                setAgbHighlight(false)
                setAgbToastVisible(false)
              }
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-accent"
          />
          <span className="text-sm leading-relaxed text-muted">
            Ich habe die{' '}
            <Link to="/agb" className="text-accent underline" target="_blank" rel="noreferrer">
              AGB
            </Link>{' '}
            gelesen und stimme zu. Ich bin damit einverstanden, dass der digitale Inhalt sofort
            verfügbar gemacht wird und verliere damit mein Widerrufsrecht. (
            <Link to="/widerruf" className="text-accent underline" target="_blank" rel="noreferrer">
              Widerrufsbelehrung
            </Link>
            )
          </span>
        </label>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PRODUCTS.map((product) => (
            <ProductCard
              key={product.packageId}
              product={product}
              loading={loadingId === product.packageId}
              onBuy={() => void handleCheckout(product.packageId)}
            />
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface/50 px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted">
              Navee
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-foreground">Navee — Demnächst verfügbar</h2>
            <p className="mt-2 text-sm text-muted">
              Wir arbeiten an Tuning Keys für die Navee-Serie.
            </p>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {NAVEE_COMING.map((name) => (
              <div
                key={name}
                className="rounded-xl border border-border bg-surface-elevated/50 p-5 opacity-50 grayscale"
              >
                <span className="mb-2 inline-block rounded-md bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                  Demnächst verfügbar
                </span>
                <p className="font-semibold text-muted">{name}</p>
                <p className="mt-2 text-xs text-muted/80">Tuning Key folgt in Kürze</p>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleWaitlist}
            className="mx-auto max-w-md rounded-xl border border-border bg-surface-elevated p-6"
          >
            <h3 className="text-sm font-semibold text-foreground">E-Mail-Warteliste</h3>
            <p className="mt-1 text-xs text-muted">Benachrichtigung, sobald Navee-Keys live sind.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={waitlistEmail}
                onChange={(event) => setWaitlistEmail(event.target.value)}
                placeholder="deine@email.de"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
              />
              <button
                type="submit"
                className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
              >
                Eintragen
              </button>
            </div>
            {waitlistSent && (
              <p className="mt-3 text-xs text-accent">✓ Danke — du stehst auf der Warteliste.</p>
            )}
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-12">
        <h2 className="text-center text-xl font-semibold text-foreground">
          Nicht sicher ob dein Scooter kompatibel ist?
        </h2>
        <p className="mt-2 text-center text-sm text-muted">
          Wähle dein Modell und gib deine DRV-Firmware-Version ein.
        </p>

        <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface-elevated p-6">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted">Scooter-Modell</span>
            <select
              value={compatModel}
              onChange={(event) => setCompatModel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent/50"
            >
              <option value="">Modell wählen…</option>
              {COMPAT_MODELS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted">Firmware-Version (DRV)</span>
            <input
              type="text"
              value={compatVersion}
              onChange={(event) => setCompatVersion(event.target.value)}
              placeholder="z. B. 1.7.3"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent/50"
            />
          </label>

          {compatResult && (
            <div
              className={[
                'rounded-lg border px-4 py-3 text-sm',
                compatResult.ok
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-100',
              ].join(' ')}
            >
              {compatResult.message}
              {compatResult.ok && compatResult.product && (
                <button
                  type="button"
                  onClick={() => void handleCheckout(compatResult.product!.packageId)}
                  className="mt-3 block text-xs font-semibold underline"
                >
                  Direkt zum passenden Paket →
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <ShopFaq />

      <section className="border-t border-border bg-surface/50 px-4 py-10">
        <ul className="mx-auto flex max-w-3xl flex-col gap-3 text-center text-sm text-muted sm:text-left">
          {TRUST_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <CustomerReviews />

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted/80">
          Nach dem Kauf erhältst du deinen Key per E-Mail. Flashing startest du in der{' '}
          <Link to="/tuner" className="text-accent underline">
            Scooter Unlock App
          </Link>
          .
        </p>
      </section>
    </div>
  )
}

function CountdownUnit({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.5ch] rounded-lg border border-border bg-surface-elevated px-2 py-1">
        {value}
      </span>
      <span className="mt-1 text-[10px] uppercase text-muted">{label}</span>
    </div>
  )
}
