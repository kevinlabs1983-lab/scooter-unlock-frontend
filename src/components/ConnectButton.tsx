import { Bluetooth, Check, ChevronRight } from 'lucide-react'
import { isBrowserReady } from './BrowserCheck.tsx'
import { useBluetooth } from '../hooks/useBluetooth.ts'

interface ConnectButtonProps {
  /** Nach erfolgreicher Verbindung — Weiter zum nächsten Wizard-Schritt */
  onContinue?: () => void
}

export function ConnectButton({ onContinue }: ConnectButtonProps) {
  const { status, connect } = useBluetooth()
  const browserReady = isBrowserReady()

  const isBusy = status === 'connecting' || status === 'handshake'
  const isConnected = status === 'connected'
  const canConnect = !isConnected && !isBusy && browserReady

  const handleConnect = () => {
    if (canConnect) {
      void connect()
    }
  }

  if (isConnected) {
    return (
      <div className="relative flex flex-col items-center gap-4">
        <div
          className="relative z-10 flex h-16 min-w-[220px] cursor-default items-center justify-center gap-3 rounded-xl border border-accent/50 bg-accent/10 px-8 font-semibold tracking-wide text-accent"
          aria-live="polite"
        >
          <Check className="h-5 w-5 text-accent" aria-hidden />
          <span>Verbunden ✓</span>
        </div>

        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="flex min-w-[220px] items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-8 py-3 text-sm font-semibold text-accent transition-all duration-300 hover:bg-accent/20 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)]"
          >
            Weiter
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    )
  }

  const label = isBusy ? 'Verbinde...' : 'Verbinden'
  const isDisabled = isBusy || !browserReady

  return (
    <div className="relative flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleConnect}
        disabled={isDisabled}
        className={[
          'relative z-10 flex h-16 min-w-[220px] items-center justify-center gap-3 rounded-xl border px-8',
          'font-semibold tracking-wide transition-all duration-300',
          isBusy
            ? 'cursor-wait border-accent/30 bg-surface-elevated text-accent'
            : !browserReady
              ? 'cursor-not-allowed border-border/50 bg-surface-elevated/50 text-muted opacity-60'
              : 'border-border bg-surface-elevated text-foreground hover:border-accent/50 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)]',
        ].join(' ')}
      >
        <Bluetooth
          className={`h-5 w-5 ${isBusy ? 'animate-pulse text-accent' : 'text-accent'}`}
          aria-hidden
        />
        <span>{label}</span>
      </button>

      {isBusy && (
        <>
          <span
            className="pointer-events-none absolute top-1/2 left-1/2 h-16 w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-accent/40 animate-pulse-ring"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute top-1/2 left-1/2 h-16 w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-accent/20 animate-pulse-ring [animation-delay:0.5s]"
            aria-hidden
          />
        </>
      )}
    </div>
  )
}
