import { useEffect, useRef } from 'react'
import { Terminal, Trash2 } from 'lucide-react'
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
  if (
    entry.message.toLowerCase().includes('ble') ||
    entry.message.toLowerCase().includes('gatt') ||
    entry.message.toLowerCase().includes('0x')
  ) {
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

export function LogConsole() {
  const { logs, clearLogs } = useBluetooth()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [logs])

  return (
    <section className="animate-fade-in rounded-xl border border-border bg-surface transition-all duration-300">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Log-Konsole</h2>
        </div>
        <button
          type="button"
          onClick={clearLogs}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors duration-200 hover:bg-surface-elevated hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Leeren
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto bg-terminal p-4 font-mono-tech text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <p className="text-muted/50">// Bereit — warte auf BLE-Ereignisse…</p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="animate-terminal-line border-b border-white/5 py-1 last:border-0"
            >
              <span className="text-muted/60">[{formatTime(entry.timestamp)}]</span>{' '}
              <span className={logColor(entry)}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
