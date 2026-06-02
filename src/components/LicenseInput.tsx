import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, ShieldX } from 'lucide-react'
import {
  activateLicense,
  formatLicenseInput,
  isMockLicense,
  isMockLicenseMode,
  isValidLicenseFormat,
  MOCK_LICENSE_KEY,
  type LicenseActivationResult,
} from '../lib/license.ts'

interface LicenseInputProps {
  resetToken?: number
  initialLicenseKey?: string
  onActivatedChange?: (result: LicenseActivationResult) => void
}

export function LicenseInput({
  resetToken = 0,
  initialLicenseKey = '',
  onActivatedChange,
}: LicenseInputProps) {
  const [license, setLicense] = useState('')
  const [activated, setActivated] = useState(false)
  const [touched, setTouched] = useState(false)

  const valid = isValidLicenseFormat(license)
  const showValidation = touched && license.length > 0
  const isMockKey = isMockLicense(license)

  useEffect(() => {
    setLicense('')
    setActivated(false)
    setTouched(false)
    onActivatedChange?.({ activated: false, licenseKey: '', isMock: false })
  }, [resetToken, onActivatedChange])

  useEffect(() => {
    const trimmed = initialLicenseKey.trim()
    if (!trimmed) {
      return
    }

    setLicense(formatLicenseInput(trimmed))
    setTouched(true)
  }, [initialLicenseKey])

  const handleChange = (value: string) => {
    setTouched(true)
    setActivated(false)
    setLicense(formatLicenseInput(value))
  }

  const handleActivate = () => {
    setTouched(true)
    const result = activateLicense(license)
    if (!result.activated) {
      return
    }
    setActivated(true)
    onActivatedChange?.(result)
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 transition-all duration-300">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Lizenzschlüssel</h2>
      </div>

      {isMockLicenseMode() && (
        <p className="mb-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent">
          Test-Modus: <span className="font-mono-tech">{MOCK_LICENSE_KEY}</span>
        </p>
      )}

      <label className="block">
        <span className="sr-only">Lizenzschlüssel</span>
        <input
          type="text"
          value={license}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          spellCheck={false}
          className={[
            'w-full rounded-lg border bg-surface-elevated px-4 py-3 font-mono-tech text-sm tracking-widest',
            'text-foreground placeholder:text-muted/50 outline-none transition-all duration-300',
            showValidation && valid
              ? 'border-green-500/60 focus:ring-2 focus:ring-green-500/30'
              : showValidation && !valid
                ? 'border-red-500/60 focus:ring-2 focus:ring-red-500/30'
                : 'border-border focus:border-accent/50 focus:ring-2 focus:ring-accent/20',
          ].join(' ')}
        />
      </label>

      <div className="mt-3 flex min-h-6 items-center gap-2 text-xs transition-opacity duration-300">
        {showValidation && valid && (
          <>
            <ShieldCheck className="h-4 w-4 text-green-400" aria-hidden />
            <span className="text-green-400">
              {isMockKey ? 'Mock-Lizenz erkannt' : 'Gültiges Format'}
            </span>
          </>
        )}
        {showValidation && !valid && (
          <>
            <ShieldX className="h-4 w-4 text-red-400" aria-hidden />
            <span className="text-red-400">Ungültiges Format — XXXX-XXXX-XXXX-XXXX</span>
          </>
        )}
        {activated && (
          <span className="ml-auto text-accent">
            {isMockKey ? 'Mock-Lizenz aktiviert ✓' : 'Lizenz aktiviert ✓'}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleActivate}
        disabled={!valid}
        className={[
          'mt-4 w-full rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all duration-300',
          valid
            ? 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:shadow-[0_0_20px_rgba(0,212,255,0.12)]'
            : 'cursor-not-allowed border-border bg-surface-elevated text-muted',
        ].join(' ')}
      >
        Aktivieren
      </button>
    </section>
  )
}

export type { LicenseActivationResult }
