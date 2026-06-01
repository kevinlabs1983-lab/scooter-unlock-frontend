import { CheckCircle2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function Success() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  return (
    <main className="animate-fade-in mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full flex-col items-center gap-6 rounded-xl border border-green-500/40 bg-green-500/5 px-6 py-12 text-center shadow-[0_0_40px_rgba(34,197,94,0.08)]">
        <CheckCircle2
          className="h-20 w-20 text-green-400 animate-[pulse_2s_ease-in-out_3]"
          aria-hidden
        />

        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Zahlung erfolgreich! 🎉
          </h1>
          <p className="mt-4 text-base leading-relaxed text-foreground/90">
            Dein Lizenzschlüssel wurde an deine E-Mail gesendet.
          </p>
          <p className="mt-2 text-sm text-muted">Prüfe auch deinen Spam-Ordner.</p>
        </div>

        {sessionId && (
          <p className="font-mono-tech max-w-full truncate text-[10px] text-muted/70">
            Session: {sessionId}
          </p>
        )}

        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="flex flex-1 items-center justify-center rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-all duration-300 hover:bg-accent/20 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)] sm:flex-none sm:px-6"
          >
            Jetzt Scooter tunen →
          </Link>
          <Link
            to="/shop"
            className="flex flex-1 items-center justify-center rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm font-semibold text-foreground transition-all duration-300 hover:border-accent/40 hover:text-accent sm:flex-none sm:px-6"
          >
            Zum Shop →
          </Link>
        </div>
      </div>
    </main>
  )
}
