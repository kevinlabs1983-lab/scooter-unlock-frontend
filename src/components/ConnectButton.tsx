import { Bluetooth, Check } from 'lucide-react'
import { isBrowserReady } from './BrowserCheck.tsx'
import { useBluetooth } from '../hooks/useBluetooth.ts'

export function ConnectButton() {
  const { status, connect, disconnect } = useBluetooth()
  const browserReady = isBrowserReady()

  const isBusy = status === 'connecting' || status === 'handshake'
  const isConnected = status === 'connected'
  const isDisabled = isBusy || (!isConnected && !browserReady)

  const label = isConnected
    ? 'Verbunden ✓'
    : isBusy
      ? 'Verbinde...'
      : 'Verbinden'

  const handleClick = () => {
    if (isConnected) {
      disconnect()
      return
    }
    if (!isBusy && browserReady) {
      void connect()
    }
  }

  return (
    <div className="relative flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={[
          'relative z-10 flex h-16 min-w-[220px] items-center justify-center gap-3 rounded-xl border px-8',
          'font-semibold tracking-wide transition-all duration-300',
          isConnected
            ? 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20'
            : isBusy
              ? 'cursor-wait border-accent/30 bg-surface-elevated text-accent'
              : !browserReady
                ? 'cursor-not-allowed border-border/50 bg-surface-elevated/50 text-muted opacity-60'
                : 'border-border bg-surface-elevated text-foreground hover:border-accent/50 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)]',
        ].join(' ')}
      >
        {isConnected ? (
          <Check className="h-5 w-5 text-accent" aria-hidden />
        ) : (
          <Bluetooth
            className={`h-5 w-5 ${isBusy ? 'text-accent animate-pulse' : 'text-accent'}`}
            aria-hidden
          />
        )}
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
