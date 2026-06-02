import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Ist das Tuning legal?',
    answer:
      'Der Tuning-Key ist ein legales Produkt. Die Nutzung ist auf Privatgelände und im Ausland unbedenklich. Die Verwendung im öffentlichen Straßenverkehr in Deutschland ist ohne gesonderte Genehmigung nicht erlaubt.',
  },
  {
    question: 'Funktioniert das auf meinem iPhone / iOS?',
    answer:
      'Web Bluetooth wird von Safari nicht unterstützt. Lade dir die kostenlose App „Bluefy“ aus dem App Store – damit funktioniert der Tuner auch auf iOS.',
  },
  {
    question: 'Wie aktiviere ich das Tuning nach dem Kauf?',
    answer:
      'Du erhältst deinen Lizenzkey sofort per E-Mail. Klicke auf den Link in der Mail, der Tuner öffnet sich mit deinem Key bereits vorausgefüllt. Verbinde deinen Scooter per Bluetooth und klicke auf „Aktivieren“.',
  },
  {
    question: 'Kann ich das Tuning wieder rückgängig machen?',
    answer:
      'Ja, das Tuning ist vollständig reversibel. Im Tuner gibt es die Option, die Original-Firmware wiederherzustellen. Nach dem Zurücksetzen verhält sich der Scooter wieder wie ab Werk.',
  },
  {
    question: 'Mein Scooter wird nicht erkannt / verbindet sich nicht.',
    answer:
      'Stelle sicher, dass die Ninebot/Segway App komplett geschlossen ist (nicht nur minimiert). Bluetooth muss aktiviert sein und dem Browser müssen Bluetooth-Rechte erteilt werden. Am zuverlässigsten funktioniert es mit Chrome auf Android oder Windows.',
  },
  {
    question: 'Der Lizenzkey wird als ungültig angezeigt.',
    answer:
      'Bitte den Key exakt so eingeben wie zugesendet, inklusive aller Bindestriche. Keine Leerzeichen davor oder danach. Am besten Copy & Paste verwenden.',
  },
  {
    question: 'Das Tuning ist aktiv, aber der Scooter fährt nicht schneller als erwartet.',
    answer:
      'Lade den Akku vollständig auf, fahre ca. 400 Meter, lade dann erneut voll. Danach sollte die volle Geschwindigkeit erreicht werden.',
  },
  {
    question: 'Was passiert, wenn ich meinen Key verliere?',
    answer:
      'Schreibe uns an support@scooter-unlock.de mit deiner Bestell-E-Mail, wir schicken dir den Key erneut zu.',
  },
]

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
}) {
  const panelId = `faq-panel-${item.question}`
  const buttonId = `faq-button-${item.question}`

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-accent"
      >
        <span className="text-sm font-medium text-foreground">{item.question}</span>
        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 text-muted transition-transform duration-300',
            isOpen ? 'rotate-180 text-accent' : '',
          ].join(' ')}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="pb-4 text-sm leading-relaxed text-muted">{item.answer}</p>
        </div>
      </div>
    </div>
  )
}

export function ShopFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="text-center text-2xl font-semibold text-foreground">
        Häufig gestellte Fragen
      </h2>

      <div className="mt-8 rounded-2xl border border-border bg-surface-elevated px-5 sm:px-6">
        {FAQ_ITEMS.map((item, index) => (
          <FaqAccordionItem
            key={item.question}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
          />
        ))}
      </div>
    </section>
  )
}
