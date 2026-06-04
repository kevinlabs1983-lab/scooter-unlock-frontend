import { AlertTriangle, CheckCircle2, Globe, Lock, Radio } from 'lucide-react'
import { checkBrowserSupport } from '../lib/browser-check.ts'

interface BrowserCheckProps {
  compact?: boolean
}

export function BrowserCheck({ compact = false }: BrowserCheckProps) {
  const result = checkBrowserSupport()

  if (result.isReady) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-400 transition-all duration-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {result.browserName} · HTTPS · Web Bluetooth bereit
          </span>
        </div>
      )
    }

    return (
      <aside className="animate-fade-in rounded-xl border border-green-500/30 bg-green-500/5 p-4 transition-all duration-300">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-green-400">
              Browser kompatibel
            </p>
            <p className="mt-1 text-xs text-muted">
              {result.browserName} · sichere Verbindung · Web Bluetooth verfügbar
            </p>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="animate-fade-in rounded-xl border border-red-500/40 bg-red-500/5 p-4 transition-all duration-300"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-400">
              Browser nicht kompatibel
            </p>
            <p className="mt-1 text-xs text-muted">
              Web Bluetooth benötigt HTTPS und einen unterstützten Browser
              (Chrome 56+, Edge 79+, Chrome Android oder Bluefy auf iOS).
            </p>
          </div>

          <ul className="space-y-2">
            {result.issues.map((issue) => (
              <li key={issue} className="text-xs leading-relaxed text-red-300/90">
                {issue}
              </li>
            ))}
          </ul>

          <div className="grid gap-2 sm:grid-cols-3">
            <StatusChip
              ok={result.isSecureContext}
              icon={Lock}
              label={result.isSecureContext ? 'HTTPS aktiv' : 'Kein HTTPS'}
            />
            <StatusChip
              ok={result.hasBluetooth}
              icon={Radio}
              label={result.hasBluetooth ? 'Bluetooth API' : 'Kein Bluetooth API'}
            />
            <StatusChip
              ok={result.isSupportedBrowser}
              icon={Globe}
              label={result.browserName}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}

function StatusChip({
  ok,
  icon: Icon,
  label,
}: {
  ok: boolean
  icon: typeof Lock
  label: string
}) {
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] transition-colors duration-300',
        ok
          ? 'border-green-500/30 bg-green-500/5 text-green-400'
          : 'border-red-500/30 bg-red-500/10 text-red-300',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  )
}

export function isBrowserReady(): boolean {
  return checkBrowserSupport().isReady
}
