import { Link } from 'react-router-dom'

const LEGAL_LINKS = [
  { to: '/impressum', label: 'Impressum' },
  { to: '/datenschutz', label: 'Datenschutz' },
  { to: '/agb', label: 'AGB' },
  { to: '/widerruf', label: 'Widerruf' },
] as const

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm"
          aria-label="Rechtliches"
        >
          {LEGAL_LINKS.map((link, index) => (
            <span key={link.to} className="flex items-center gap-4">
              {index > 0 && <span className="hidden text-border sm:inline">|</span>}
              <Link
                to={link.to}
                className="text-muted transition-colors hover:text-accent"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>

        <p className="mt-6 text-center text-xs text-muted">
          © 2025 <span className="text-foreground/80">Scooter Unlock</span> – Alle Rechte vorbehalten
        </p>

        <p className="mt-2 text-center text-xs text-amber-400/90">
          Nur für Privatgelände – keine Straßenzulassung
        </p>
      </div>
    </footer>
  )
}
