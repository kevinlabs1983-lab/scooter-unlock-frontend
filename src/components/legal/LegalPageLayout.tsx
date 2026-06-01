import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface LegalPageLayoutProps {
  title: string
  children: ReactNode
}

export function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <main className="animate-fade-in mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link
        to="/shop"
        className="text-xs text-accent transition-colors hover:underline"
      >
        ← Zurück zum Shop
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>

      <article className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted">
        {children}
      </article>
    </main>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="rounded bg-accent/10 px-1 text-accent">{children}</span>
}
