import { Link } from 'react-router-dom'
import { LegalPageLayout, LegalSection } from '../../components/legal/LegalPageLayout.tsx'

const EMAIL = 'info@scooter-unlock.de'

export default function AGB() {
  return (
    <LegalPageLayout title="Allgemeine Geschäftsbedingungen (AGB)">
      <p className="text-foreground/90">Anbieter: Kevin Labs — Stand: Juni 2026</p>

      <LegalSection title="§ 1 Vertragsgegenstand">
        <p>
          Gegenstand des Vertrages ist der Erwerb eines digitalen Lizenzschlüssels zur Nutzung der
          Software „Scooter Unlock“ für den persönlichen Gebrauch auf kompatiblen Ninebot-Scootern.
          Der Lizenzschlüssel wird nach Zahlungseingang per E-Mail zugestellt.
        </p>
      </LegalSection>

      <LegalSection title="§ 2 Vertragsschluss">
        <p>
          Die Darstellung der Produkte im Shop stellt kein rechtlich bindendes Angebot dar. Mit
          Abschluss des Bestellvorgangs über Stripe geben Sie ein verbindliches Angebot ab. Der
          Vertrag kommt zustande, wenn wir die Zahlung über Stripe bestätigen und den
          Lizenzschlüssel bereitstellen.
        </p>
      </LegalSection>

      <LegalSection title="§ 3 Preise und Zahlung">
        <p>
          Alle Preise verstehen sich in Euro inklusive der gesetzlichen Mehrwertsteuer, sofern
          anwendbar. Die Zahlung erfolgt ausschließlich über die von Stripe angebotenen
          Zahlungsmethoden.
        </p>
      </LegalSection>

      <LegalSection title="§ 4 Lieferung">
        <p>
          Die Lieferung erfolgt unverzüglich nach erfolgreicher Zahlung in digitaler Form per
          E-Mail an die von Ihnen angegebene Adresse. Bitte prüfen Sie auch Ihren Spam-Ordner.
        </p>
      </LegalSection>

      <LegalSection title="§ 5 Widerrufsrecht">
        <p>
          Verbrauchern steht grundsätzlich ein Widerrufsrecht von 14 Tagen zu. Details entnehmen Sie
          unserer{' '}
          <Link to="/widerruf" className="text-accent hover:underline">
            Widerrufsbelehrung
          </Link>
          .
        </p>
        <p className="rounded-lg border border-border bg-surface-elevated p-4 text-foreground/90">
          Bei digitalen Inhalten erlischt das Widerrufsrecht, sobald der Download bzw. die Nutzung
          begonnen hat <strong>und</strong> der Kunde ausdrücklich zugestimmt hat, dass er sein
          Widerrufsrecht verliert, sobald wir mit der Ausführung des Vertrags beginnen.
        </p>
      </LegalSection>

      <LegalSection title="§ 6 Nutzung und Haftungsausschluss">
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
          Die Software dient ausschließlich der privaten Nutzung auf Privatgelände. Jegliche
          Nutzung im öffentlichen Straßenverkehr ist verboten und liegt in der alleinigen
          Verantwortung des Nutzers.
        </p>
        <p>
          Der Nutzer ist dafür verantwortlich, dass die Verwendung der Software mit geltenden
          Gesetzen, Herstellervorgaben und Versicherungsbedingungen vereinbar ist. Wir übernehmen
          keine Haftung für Schäden, die durch unsachgemäße Nutzung, Firmware-Modifikationen oder
          Einsatz im Straßenverkehr entstehen.
        </p>
      </LegalSection>

      <LegalSection title="§ 7 Gewährleistung">
        <p>
          Es gelten die gesetzlichen Gewährleistungsrechte für digitale Produkte. Bei
          Funktionsstörungen kontaktieren Sie uns unter{' '}
          <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">
            {EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="§ 8 Haftungsbeschränkung">
        <p>
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von
          Leben, Körper oder Gesundheit. Im Übrigen ist die Haftung auf vorhersehbare,
          vertragstypische Schäden begrenzt, soweit gesetzlich zulässig.
        </p>
      </LegalSection>

      <LegalSection title="§ 9 Gerichtsstand">
        <p>
          Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
          Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem
          Vertrag Berlin, Deutschland. Zwingende verbraucherschutzrechtliche Vorschriften bleiben
          unberührt.
        </p>
      </LegalSection>

      <LegalSection title="§ 10 Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Sollten
          einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Regelungen
          unberührt.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
