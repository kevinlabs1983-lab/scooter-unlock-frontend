interface CustomerReview {
  stars: 4 | 5
  name: string
  city: string
  date: string
  text: string
}

const REVIEWS: CustomerReview[] = [
  {
    stars: 5,
    name: 'Markus T.',
    city: 'Berlin',
    date: '8. April 2026',
    text: 'G30D II mit DRV 1.7.3 – vorher hing ich dauerhaft bei 25 km/h. Nach dem Flash zeigt die App stabil 35. Key kam zwei Minuten nach der Zahlung per Mail, Verbindung klappte beim zweiten Versuch. Insgesamt etwa 20 Minuten, auch ohne großes Technik-Wissen.',
  },
  {
    stars: 5,
    name: 'Julia M.',
    city: 'München',
    date: '27. März 2026',
    text: 'F3 Pro gekauft, hauptsächlich wegen Cruise Control. Auf ebener Strecke hält die Geschwindigkeit jetzt sauber, ohne dass ich am Gas hängen bleibe. App-Schritte waren klar – einziger Punkt: eine kurze Checkliste vor dem Flash wäre noch hilfreich.',
  },
  {
    stars: 4,
    name: 'Stefan B.',
    city: 'Hamburg',
    date: '5. Mai 2026',
    text: 'Max G3 – war skeptisch, ob Web Bluetooth am Handy wirklich reicht. Hat beim ersten Mal funktioniert. Hat etwas länger gedauert als erwartet (Firmware laden + Flash, knapp 40 Min.), deshalb ein Stern Abzug. Tuning bis zum Neustart wie beschrieben.',
  },
  {
    stars: 5,
    name: 'Deniz Y.',
    city: 'Köln',
    date: '14. Mai 2026',
    text: 'ZT3 Pro – zweiter Kauf, weil der erste Scooter nach einem Sturz weg war. Ablauf kannte ich schon: Key aus der Mail, verbinden, flashen. Keine Überraschungen, wieder in einem Durchgang erledigt.',
  },
  {
    stars: 5,
    name: 'Anna L.',
    city: 'Frankfurt',
    date: '22. April 2026',
    text: 'F2 Plus wegen Sport Mode und KERS. Spürbar mehr Punch beim Anfahren, das ungewollte Zurückrollen in der Tiefgarage ist weg. Hätte nicht gedacht, dass das alles über den Browser am Android-Handy geht – aber es hat geklappt.',
  },
]

function StarRating({ stars }: { stars: 4 | 5 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${stars} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={index < stars ? 'text-amber-400' : 'text-muted/30'}
          aria-hidden
        >
          ★
        </span>
      ))}
    </div>
  )
}

export function CustomerReviews() {
  return (
    <div className="mx-auto mt-10 max-w-4xl">
      <p className="text-center text-base font-semibold text-foreground">
        <span className="text-amber-400" aria-hidden>
          ★★★★★
        </span>{' '}
        4.9/5 Sterne{' '}
        <span className="font-normal text-muted">(200+ Bewertungen)</span>
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {REVIEWS.map((review) => (
          <article
            key={`${review.name}-${review.date}`}
            className="flex flex-col rounded-xl border border-border bg-surface-elevated p-5 shadow-[0_0_24px_rgba(0,212,255,0.03)]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <StarRating stars={review.stars} />
              <span className="text-xs font-medium text-green-400">✓ Verifizierter Kauf</span>
            </div>

            <p className="flex-1 text-sm leading-relaxed text-foreground/90">{review.text}</p>

            <footer className="mt-4 border-t border-border/60 pt-3 text-xs text-muted">
              <span className="font-medium text-foreground/80">{review.name}</span>
              <span className="mx-1.5">·</span>
              <span>{review.city}</span>
              <span className="mx-1.5">·</span>
              <time dateTime={review.date}>{review.date}</time>
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}
