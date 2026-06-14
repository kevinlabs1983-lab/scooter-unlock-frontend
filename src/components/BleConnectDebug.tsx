import { useEffect, useRef } from 'react'
import { Radio, Trash2 } from 'lucide-react'
import { useBluetooth } from '../hooks/useBluetooth.ts'
import type { LogEntry } from '../store/bluetoothStore.ts'

function logColor(entry: LogEntry): string {
  if (entry.level === 'error') {
    return 'text-red-400'
  }
  if (entry.level === 'warn') {
    return 'text-yellow-400'
  }
  if (entry.level === 'success') {
    return 'text-accent'
  }
  return 'text-green-400'
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function BleConnectDebug() {
  const { logs, clearLogs, status, showPowerButtonModal } = useBluetooth()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [logs])

  return (
    <section className="w-full max-w-md rounded-xl border border-border bg-surface">
      {showPowerButtonModal && (
        <div
          className="border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200"
          role="alert"
        >
          <strong>Power-Taste drücken:</strong> Halte die Ein/Aus-Taste am Roller kurz, damit
          SET_PWD bestätigt werden kann.
        </div>
      )}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">BLE Debug</h2>
          <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            {status}
          </span>
        </div>
        <button
          type="button"
          onClick={clearLogs}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Leeren
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 min-h-40 overflow-y-auto bg-terminal p-3 font-mono-tech text-[11px] leading-relaxed"
        aria-live="polite"
        aria-relevant="additions"
      >
        {logs.length === 0 ? (
          <p className="text-muted/50">// Tippe „Verbinden“ — Schritte erscheinen hier…</p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="border-b border-white/5 py-1 last:border-0">
              <span className="text-muted/60">[{formatTime(entry.timestamp)}]</span>{' '}
              <span className={logColor(entry)}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
