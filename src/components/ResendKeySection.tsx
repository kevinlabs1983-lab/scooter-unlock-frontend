import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getApiBase } from '../lib/api.ts'

export function ResendKeySection() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${getApiBase()}/api/resend-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }

      if (response.status === 404) {
        setError('Keine Lizenz für diese E-Mail gefunden.')
        return
      }

      if (response.status === 429) {
        setError('Zu viele Anfragen. Bitte warte eine Stunde.')
        return
      }

      if (!response.ok) {
        setError(payload.error ?? 'Anfrage fehlgeschlagen. Bitte versuche es später erneut.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Verbindung zum Server fehlgeschlagen. Bitte versuche es später erneut.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = success || loading

  return (
    <section className="mx-auto max-w-xl px-4 pb-12">
      <div className="rounded-xl border border-border/80 bg-surface/60 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">
          🔑 Key verloren oder E-Mail nicht gefunden?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Gib deine Bestell-E-Mail ein – wir schicken dir deinen Key erneut zu.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
          <label className="block">
            <span className="sr-only">E-Mail Adresse</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="deine@email.de"
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <button
            type="submit"
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Wird gesendet…
              </>
            ) : (
              'Key erneut zusenden'
            )}
          </button>
        </form>

        {success && (
          <p className="mt-3 text-sm text-green-400" role="status">
            ✓ Dein Key wurde erneut an deine E-Mail gesendet.
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
