import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useBluetooth } from '../hooks/useBluetooth.ts'
import { useFlash } from '../hooks/useFlash.ts'

const ACTIVE_FLASH_STATUSES = new Set(['preparing', 'flashing', 'verifying'])

export function FlashProgress() {
  const { logs } = useBluetooth()
  const { flashStatus, progress, currentChunk, totalChunks, error } = useFlash()
  const logRef = useRef<HTMLDivElement>(null)

  const visible =
    flashStatus !== 'idle' ||
    progress > 0 ||
    error !== null

  const isActive = ACTIVE_FLASH_STATUSES.has(flashStatus)
  const flashLogs = logs.filter(
    (entry) =>
      entry.message.toLowerCase().includes('flash') ||
      entry.message.toLowerCase().includes('firmware') ||
      entry.message.toLowerCase().includes('verifiz'),
  )

  useEffect(() => {
    const container = logRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [flashLogs.length, progress])

  if (!visible) {
    return null
  }

  return (
    <section
      className="animate-fade-in rounded-xl border border-border bg-surface p-5 transition-all duration-500"
      aria-live="polite"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Firmware Flash</h2>
        {isActive && (
          <Loader2 className="h-4 w-4 animate-spin-slow text-accent" aria-hidden />
        )}
        <span className="font-mono-tech text-xs uppercase tracking-wider text-muted">
          {flashStatus}
        </span>
      </div>

      <div className="mb-2 flex items-end justify-between gap-4">
        <span className="font-mono-tech text-2xl font-semibold text-accent">
          {progress}%
        </span>
        {totalChunks > 0 && (
          <span className="font-mono-tech text-sm text-muted">
            Chunk {currentChunk}/{totalChunks}
          </span>
        )}
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-400 transition-opacity duration-300">{error}</p>
      )}

      <div
        ref={logRef}
        className="max-h-40 overflow-y-auto rounded-lg border border-border bg-terminal p-3 font-mono-tech text-xs leading-relaxed"
      >
        {flashLogs.length === 0 ? (
          <p className="text-muted/60">Warte auf Flash-Logs…</p>
        ) : (
          flashLogs.map((entry) => (
            <p
              key={entry.id}
              className="animate-terminal-line text-terminal-text"
            >
              <span className="text-muted/70">
                {new Date(entry.timestamp).toLocaleTimeString('de-DE')}
              </span>{' '}
              <span
                className={
                  entry.level === 'error'
                    ? 'text-red-400'
                    : entry.level === 'warn'
                      ? 'text-yellow-400'
                      : entry.level === 'success'
                        ? 'text-accent'
                        : 'text-green-400'
                }
              >
                {entry.message}
              </span>
            </p>
          ))
        )}
      </div>
    </section>
  )
}
