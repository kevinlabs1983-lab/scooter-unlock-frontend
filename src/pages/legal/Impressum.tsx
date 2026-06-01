import { LegalPageLayout, LegalSection } from '../../components/legal/LegalPageLayout.tsx'

const EMAIL = 'info@scooter-unlock.de'
const WEBSITE = 'https://www.scooter-unlock.de'

export default function Impressum() {
  return (
    <LegalPageLayout title="Impressum">
      <p className="text-foreground/90">Angaben gemäß § 5 TMG</p>

      <LegalSection title="Anbieter">
        <p>
          Kevin Labs
          <br />
          Zeuschelstraße 54b
          <br />
          13127 Berlin
          <br />
          Deutschland
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
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

      <LegalSection title="Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV">
        <p>
          Kevin Labs
          <br />
          Zeuschelstraße 54b
          <br />
          13127 Berlin
          <br />
          Deutschland
        </p>
      </LegalSection>

      <LegalSection title="EU-Streitschlichtung">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>
    </LegalPageLayout>
  )
}
