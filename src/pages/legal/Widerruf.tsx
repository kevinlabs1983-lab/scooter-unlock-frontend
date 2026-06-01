import { LegalPageLayout, LegalSection } from '../../components/legal/LegalPageLayout.tsx'

const EMAIL = 'info@scooter-unlock.de'

export default function Widerruf() {
  return (
    <LegalPageLayout title="Widerrufsbelehrung">
      <LegalSection title="Widerrufsrecht">
        <p>
          Sie haben das Recht, binnen <strong>14 Tagen</strong> ohne Angabe von Gründen diesen
          Vertrag zu widerrufen. Die Frist beginnt ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Kevin Labs, Zeuschelstraße 54b, 13127
          Berlin, Deutschland, E-Mail:{' '}
          <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">
            {EMAIL}
          </a>
          ) mittels einer eindeutigen Erklärung (z. B. per E-Mail) informieren.
        </p>
      </LegalSection>

      <LegalSection title="Folgen des Widerrufs">
        <p>
          Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen
          erhalten haben, unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen, an
          dem die Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für diese Rückzahlung
          verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion
          eingesetzt haben.
        </p>
      </LegalSection>

      <LegalSection title="Ausnahme bei digitalen Inhalten">
        <p className="rounded-lg border border-border bg-surface-elevated p-4 text-foreground/90">
          Das Widerrufsrecht erlischt bei einem Vertrag über die Lieferung von digitalen Inhalten,
          die nicht auf einem körperlichen Datenträger geliefert werden, wenn wir mit der Ausführung
          des Vertrags begonnen haben, nachdem Sie
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            ausdrücklich zugestimmt haben, dass wir mit der Ausführung des Vertrags vor Ablauf der
            Widerrufsfrist beginnen, und
          </li>
          <li>
            Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der
            Ausführung Ihr Widerrufsrecht verlieren.
          </li>
        </ol>
        <p className="mt-3">
          Diese Zustimmung holen wir im Bestellprozess über eine entsprechende Checkbox ein, bevor
          Sie den Kauf abschließen.
        </p>
      </LegalSection>

      <LegalSection title="Muster-Widerrufsformular">
        <p>
          Wenn Sie den Vertrag widerrufen wollen, können Sie dieses Formular verwenden (Ausfüllen
          und zurücksenden ist nicht zwingend):
        </p>
        <div className="rounded-lg border border-border bg-surface-elevated p-4 font-mono-tech text-xs text-foreground/90">
          <p>An:</p>
          <p className="mt-2">
            Kevin Labs
            <br />
            Zeuschelstraße 54b
            <br />
            13127 Berlin
            <br />
            Deutschland
            <br />
            E-Mail: {EMAIL}
          </p>
          <p className="mt-4">
            Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den
            Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)
          </p>
          <p className="mt-2">— Bestellt am (*)/erhalten am (*)</p>
          <p>— Name des/der Verbraucher(s)</p>
          <p>— Anschrift des/der Verbraucher(s)</p>
          <p>— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
          <p>— Datum</p>
          <p className="mt-4 text-muted">(*) Unzutreffendes streichen.</p>
        </div>
      </LegalSection>
    </LegalPageLayout>
  )
}
