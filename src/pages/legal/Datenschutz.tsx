import { LegalPageLayout, LegalSection } from '../../components/legal/LegalPageLayout.tsx'

const EMAIL = 'info@scooter-unlock.de'
const WEBSITE = 'https://www.scooter-unlock.de'

export default function Datenschutz() {
  return (
    <LegalPageLayout title="Datenschutzerklärung">
      <p className="text-foreground/90">Stand: Juni 2026</p>

      <LegalSection title="1. Verantwortlicher">
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website ist:
          <br />
          Kevin Labs
          <br />
          Zeuschelstraße 54b
          <br />
          13127 Berlin
          <br />
          Deutschland
          <br />
          E-Mail:{' '}
          <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">
            {EMAIL}
          </a>
          <br />
          Website:{' '}
          <a
            href={WEBSITE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {WEBSITE}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="2. Welche Daten wir erheben">
        <p>Beim Kauf eines digitalen Lizenzschlüssels erheben wir insbesondere:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>E-Mail-Adresse (für Lizenzversand und Kaufabwicklung)</li>
          <li>Zahlungsdaten (werden direkt bei Stripe verarbeitet, nicht bei uns gespeichert)</li>
          <li>Technische Metadaten zur Lizenz (z. B. Scooter-Seriennummer bei Aktivierung)</li>
          <li>Kaufdatum, Lizenzschlüssel und Paketzuordnung</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Zweck der Verarbeitung">
        <p>
          Die Verarbeitung erfolgt zur Vertragserfüllung (Bereitstellung des Lizenzschlüssels),
          zur Kommunikation mit Ihnen sowie zur Erfüllung gesetzlicher Aufbewahrungspflichten.
        </p>
      </LegalSection>

      <LegalSection title="4. Stripe (Zahlungsabwicklung)">
        <p>
          Zahlungen werden über Stripe Payments Europe Ltd. abgewickelt. Dabei werden
          Zahlungsinformationen direkt an Stripe übermittelt. Weitere Informationen finden Sie in
          der Datenschutzerklärung von Stripe:{' '}
          <a
            href="https://stripe.com/de/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            https://stripe.com/de/privacy
          </a>
        </p>
      </LegalSection>

      <LegalSection title="5. Supabase (Datenspeicherung)">
        <p>
          Lizenz- und Aktivierungsdaten werden in einer Datenbank bei Supabase (EU-Rechenzentrum)
          gespeichert. Supabase verarbeitet Daten als Auftragsverarbeiter gemäß Art. 28 DSGVO.
          Informationen:{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            https://supabase.com/privacy
          </a>
        </p>
      </LegalSection>

      <LegalSection title="6. Resend (E-Mail-Versand)">
        <p>
          Der Versand von Lizenzschlüsseln per E-Mail erfolgt über Resend. Dabei wird Ihre
          E-Mail-Adresse an den Versanddienstleister übermittelt. Informationen:{' '}
          <a
            href="https://resend.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            https://resend.com/legal/privacy-policy
          </a>
        </p>
      </LegalSection>

      <LegalSection title="7. Weitergabe an Dritte">
        <p>
          Eine Weitergabe Ihrer personenbezogenen Daten an Dritte erfolgt nur, soweit dies für die
          Zahlungsabwicklung, den E-Mail-Versand oder die technische Bereitstellung des Dienstes
          erforderlich ist, oder wir gesetzlich dazu verpflichtet sind. Es erfolgt kein Verkauf
          Ihrer Daten.
        </p>
      </LegalSection>

      <LegalSection title="8. Speicherdauer">
        <p>
          Wir speichern Ihre Daten, solange dies für die Vertragserfüllung und gesetzliche
          Aufbewahrungsfristen erforderlich ist.
        </p>
      </LegalSection>

      <LegalSection title="9. Ihre Rechte">
        <p>Sie haben gegenüber uns folgende Rechte:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Auskunft (Art. 15 DSGVO)</li>
          <li>Berichtigung (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
          <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Kontakt Datenschutz">
        <p>
          Für Datenschutzanfragen wenden Sie sich bitte an:{' '}
          <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">
            {EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
