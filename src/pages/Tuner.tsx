import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { BrowserCheck } from '../components/BrowserCheck.tsx'
import { BleConnectDebug } from '../components/BleConnectDebug.tsx'
import { ConnectButton } from '../components/ConnectButton.tsx'
import { FlashProgress } from '../components/FlashProgress.tsx'
import { FirmwarePatcher } from '../components/FirmwarePatcher.tsx'
import { FirmwareSelector, type LoadedFirmware } from '../components/FirmwareSelector.tsx'
import { LicenseInput } from '../components/LicenseInput.tsx'
import { LogConsole } from '../components/LogConsole.tsx'
import { ScooterStatus } from '../components/ScooterStatus.tsx'
import { useBluetooth } from '../hooks/useBluetooth.ts'
import { useFlash } from '../hooks/useFlash.ts'
import { computeSha256 } from '../lib/firmware-loader.ts'
import {
  exportPatchedFirmwareViaBackend,
  type PatchConfig,
} from '../lib/firmware-patcher.ts'
import {
  isMockLicense,
  type LicenseActivationResult,
} from '../lib/license.ts'
import { useFlashStore } from '../store/flashStore.ts'
import { useBluetoothStore } from '../store/bluetoothStore.ts'

type WizardStep = 'connect' | 'device' | 'license' | 'flash'

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'connect', label: 'Verbinden' },
  { id: 'device', label: 'Gerät' },
  { id: 'license', label: 'Lizenz' },
  { id: 'flash', label: 'Flash' },
]

export default function Tuner() {
  const [searchParams] = useSearchParams()
  const urlLicenseKey = useMemo(() => searchParams.get('key')?.trim() ?? '', [searchParams])

  const { disconnect, clearLogs } = useBluetooth()
  const { startFlash, flashStatus } = useFlash()

  const [step, setStep] = useState<WizardStep>('connect')
  const [licenseActivated, setLicenseActivated] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [loadedFirmware, setLoadedFirmware] = useState<LoadedFirmware | null>(null)
  const [firmwareBlob, setFirmwareBlob] = useState<Uint8Array | null>(null)
  const [patchMeta, setPatchMeta] = useState<{
    config: PatchConfig
    sha256: string
  } | null>(null)
  const [flashTarget, setFlashTarget] = useState<LoadedFirmware['flashTarget']>('ESC')
  const [showSuccess, setShowSuccess] = useState(false)
  const [licensePatchConfig, setLicensePatchConfig] = useState<PatchConfig | null>(null)
  const stepRef = useRef<WizardStep>('connect')
  stepRef.current = step

  const handleAdvanceToDevice = useCallback(() => {
    setStep('device')
  }, [])

  useEffect(() => {
    const unsubscribe = useBluetoothStore.subscribe((state, prevState) => {
      if (state.status === 'connected' && prevState.status !== 'connected') {
        if (stepRef.current === 'connect') {
          setStep('device')
        }
        return
      }

      if (
        (state.status === 'disconnected' || state.status === 'error') &&
        state.status !== prevState.status &&
        (stepRef.current === 'device' || stepRef.current === 'license')
      ) {
        setStep('connect')
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (flashStatus === 'done') {
      setShowSuccess(true)
    }
  }, [flashStatus])

  const handleReset = useCallback(() => {
    disconnect()
    useFlashStore.getState().resetFlash()
    clearLogs()
    setStep('connect')
    setLicenseActivated(false)
    setLicenseKey('')
    setLoadedFirmware(null)
    setFirmwareBlob(null)
    setPatchMeta(null)
    setLicensePatchConfig(null)
    setFlashTarget('ESC')
    setShowSuccess(false)
    setResetToken((value) => value + 1)
  }, [disconnect, clearLogs])

  const handleFirmwareLoaded = useCallback((firmware: LoadedFirmware) => {
    setLoadedFirmware(firmware)
    setFirmwareBlob(firmware.blob)
    setFlashTarget(firmware.flashTarget)
    setPatchMeta(null)
  }, [])

  const handlePatchedFirmware = useCallback(
    (result: { data: Uint8Array; sha256: string; config: PatchConfig }) => {
      setFirmwareBlob(result.data)
      setPatchMeta({ config: result.config, sha256: result.sha256 })
    },
    [],
  )

  const handleLicenseChange = useCallback((result: LicenseActivationResult) => {
    setLicenseActivated(result.activated)
    setLicenseKey(result.licenseKey)
    setLicensePatchConfig(result.patchConfig ?? null)
    setPatchMeta(null)

    if (result.activated && result.isMock && !loadedFirmware) {
      const placeholder = new Uint8Array(0x1300).fill(0xff)
      setLoadedFirmware({
        blob: placeholder,
        sha256: '',
        verified: true,
        source: 'local',
        model: 'g30',
        component: 'DRV',
        version: '1.7.3',
        flashTarget: 'ESC',
      })
      setFirmwareBlob(placeholder)
      setFlashTarget('ESC')
    }
  }, [loadedFirmware])

  const handleStartFlash = async () => {
    if (!firmwareBlob || !loadedFirmware) {
      return
    }

    setStep('flash')
    setShowSuccess(false)

    try {
      if (patchMeta && licenseKey && !isMockLicense(licenseKey)) {
        const sha256 = patchMeta.sha256 || (await computeSha256(firmwareBlob))
        await exportPatchedFirmwareViaBackend({
          licenseKey,
          patched: firmwareBlob,
          model: loadedFirmware.model ?? 'g30',
          version: loadedFirmware.version ?? '1.6.3',
          sha256,
          config: patchMeta.config,
        })
      }

      await startFlash(firmwareBlob, flashTarget)
    } catch (error) {
      setStep('license')
      useFlashStore.getState().resetFlash()
      console.error(error)
    }
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step)

  return (
    <>
      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto flex max-w-2xl items-center justify-end gap-3 px-4 py-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-all duration-300 hover:border-accent/40 hover:text-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Zurücksetzen
          </button>
        </div>

        <nav
          className="mx-auto flex max-w-2xl gap-1 px-4 pb-4"
          aria-label="Wizard-Fortschritt"
        >
          {STEPS.map((item, index) => {
            const isActive = item.id === step
            const isDone = index < stepIndex

            return (
              <div
                key={item.id}
                className={[
                  'flex flex-1 flex-col gap-1 transition-all duration-500',
                  isActive || isDone ? 'opacity-100' : 'opacity-40',
                ].join(' ')}
              >
                <div
                  className={[
                    'h-1 rounded-full transition-all duration-500',
                    isActive
                      ? 'bg-accent shadow-[0_0_12px_rgba(0,212,255,0.5)]'
                      : isDone
                        ? 'bg-accent/60'
                        : 'bg-border',
                  ].join(' ')}
                />
                <span
                  className={[
                    'text-[10px] uppercase tracking-wider transition-colors duration-300',
                    isActive ? 'text-accent' : 'text-muted',
                  ].join(' ')}
                >
                  {item.label}
                </span>
              </div>
            )
          })}
        </nav>
      </div>

      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        {step === 'connect' && (
          <section className="animate-fade-in flex flex-1 flex-col items-center justify-center gap-8 py-8 transition-all duration-500">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                Schritt 1 — Verbinden
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Scooter verbinden
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
                Schalte deinen Scooter ein und bleibe in 5&nbsp;m Reichweite.
              </p>
            </div>

            <ConnectButton onContinue={handleAdvanceToDevice} />
            <BleConnectDebug />
            <BrowserCheck />
          </section>
        )}

        {step === 'device' && (
          <section className="animate-fade-in flex flex-1 flex-col gap-6 transition-all duration-500">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                Schritt 2 — Gerät erkannt
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Verbindung hergestellt
              </h2>
              <p className="mt-2 text-sm text-muted">
                Prüfe die Gerätedaten und fahre fort, wenn alles stimmt.
              </p>
            </div>

            <ScooterStatus />

            <button
              type="button"
              onClick={() => setStep('license')}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 py-3 text-sm font-semibold text-accent transition-all duration-300 hover:bg-accent/20 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)]"
            >
              Weiter
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </section>
        )}

        {step === 'license' && (
          <section className="animate-fade-in flex flex-1 flex-col gap-6 transition-all duration-500">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                Schritt 3 — Lizenz eingeben
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Lizenz aktivieren
              </h2>
              <p className="mt-2 text-sm text-muted">
                Gib deinen Lizenzschlüssel ein, wähle die Firmware und konfiguriere die Patches.
              </p>
            </div>

            <LicenseInput
              resetToken={resetToken}
              initialLicenseKey={urlLicenseKey}
              onActivatedChange={handleLicenseChange}
            />

            <div
              className={[
                'space-y-4 transition-all duration-500',
                licenseActivated
                  ? 'max-h-[1200px] opacity-100'
                  : 'pointer-events-none max-h-0 overflow-hidden opacity-0',
              ].join(' ')}
            >
              <FirmwareSelector onFirmwareLoaded={handleFirmwareLoaded} />

              {loadedFirmware?.component === 'DRV' && (
                <FirmwarePatcher
                  original={loadedFirmware.blob}
                  model={loadedFirmware.model ?? 'g30'}
                  version={loadedFirmware.version ?? '1.7.3'}
                  licenseKey={licenseKey}
                  licenseActivated={licenseActivated}
                  initialConfig={licensePatchConfig ?? undefined}
                  onPatched={handlePatchedFirmware}
                />
              )}

              <button
                type="button"
                onClick={() => void handleStartFlash()}
                disabled={
                  !firmwareBlob ||
                  (loadedFirmware?.component === 'DRV' && !patchMeta)
                }
                className={[
                  'flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all duration-300',
                  firmwareBlob
                    ? 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:shadow-[0_0_24px_rgba(0,212,255,0.15)]'
                    : 'cursor-not-allowed border-border bg-surface-elevated text-muted',
                ].join(' ')}
              >
                Flash starten
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </section>
        )}

        {step === 'flash' && (
          <section className="animate-fade-in flex flex-1 flex-col gap-6 transition-all duration-500">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                Schritt 4 — Flash läuft
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Firmware wird geflasht
              </h2>
              <p className="mt-2 text-sm text-muted">
                Scooter nicht ausschalten — BLE-Verbindung offen halten.
              </p>
            </div>

            <FlashProgress />
            <LogConsole />

            {showSuccess && flashStatus === 'done' && (
              <div className="animate-fade-in flex flex-col items-center gap-4 rounded-xl border border-accent/40 bg-accent/5 px-6 py-10 text-center transition-all duration-700">
                <CheckCircle2
                  className="h-16 w-16 text-accent animate-[pulse_2s_ease-in-out_3]"
                  aria-hidden
                />
                <div>
                  <p className="font-mono-tech text-2xl font-bold text-accent">Fertig!</p>
                  <p className="mt-2 text-sm text-muted">
                    Firmware erfolgreich geflasht und verifiziert.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  )
}
