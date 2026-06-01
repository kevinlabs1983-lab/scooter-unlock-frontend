import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Cpu,
  Loader2,
  Shield,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react'
import { computeSha256 } from '../lib/firmware-loader.ts'
import {
  DEFAULT_PATCH_CONFIG,
  describePatchPreview,
  getSpeedLimitRange,
  patchFirmwareWithMeta,
  validatePatchConfig,
  type PatchConfig,
} from '../lib/firmware-patcher.ts'

interface FirmwarePatcherProps {
  original: Uint8Array
  model: string
  version: string
  licenseKey: string | null
  licenseActivated: boolean
  initialConfig?: PatchConfig
  disabled?: boolean
  onPatched?: (result: { data: Uint8Array; sha256: string; config: PatchConfig }) => void
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-elevated/50 px-3 py-3 transition-colors duration-300 hover:border-accent/20">
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-accent"
      />
    </label>
  )
}

export function FirmwarePatcher({
  original,
  model,
  version,
  licenseKey,
  licenseActivated,
  initialConfig,
  disabled = false,
  onPatched,
}: FirmwarePatcherProps) {
  const [config, setConfig] = useState<PatchConfig>(initialConfig ?? DEFAULT_PATCH_CONFIG)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedSha256, setGeneratedSha256] = useState<string | null>(null)
  const [patchCount, setPatchCount] = useState(0)

  const speedRange = useMemo(() => getSpeedLimitRange(model), [model])
  const validation = useMemo(() => validatePatchConfig(config, model), [config, model])
  const preview = useMemo(
    () => describePatchPreview(config, model, version),
    [config, model, version],
  )

  useEffect(() => {
    const base = initialConfig ?? DEFAULT_PATCH_CONFIG
    setConfig({
      ...base,
      speedLimit: Math.min(base.speedLimit, speedRange.max),
    })
    setGeneratedSha256(null)
    setPatchCount(0)
    setError(null)
  }, [initialConfig, model, version, original, speedRange.max])

  const updateConfig = <K extends keyof PatchConfig>(key: K, value: PatchConfig[K]) => {
    setGeneratedSha256(null)
    setPatchCount(0)
    setError(null)
    setConfig((current) => ({ ...current, [key]: value }))
  }

  const handleGenerate = async () => {
    setError(null)

    if (!validation.valid) {
      setError(validation.errors.join(' · '))
      return
    }

    if (!licenseActivated || !licenseKey) {
      setError('Bitte zuerst einen gültigen Lizenzschlüssel aktivieren')
      return
    }

    setIsGenerating(true)

    try {
      const result = patchFirmwareWithMeta(original, model, version, config)
      const sha256 = await computeSha256(result.data)

      setGeneratedSha256(sha256)
      setPatchCount(result.appliedPatches.length)
      onPatched?.({ data: result.data, sha256, config })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  const activePreview = preview.filter((item) => item.active)

  return (
    <section className="animate-fade-in space-y-4 rounded-xl border border-border bg-surface p-5 transition-all duration-300">
      <div className="flex items-start gap-3">
        <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Firmware-Patcher</h2>
          <p className="mt-1 text-xs text-muted">
            Patches werden ausschließlich lokal im Browser angewendet. Ein Export erfolgt
            nur mit gültiger Lizenz über das Backend.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent/90">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Modell {model.toUpperCase()} · Version {version} · {original.length.toLocaleString('de-DE')} Bytes
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Speed-Limit
          </span>
          <span className="font-mono-tech text-accent">{config.speedLimit} km/h</span>
        </div>
        <input
          type="range"
          min={speedRange.min}
          max={speedRange.max}
          step={1}
          value={config.speedLimit}
          disabled={disabled || isGenerating}
          onChange={(event) => updateConfig('speedLimit', Number(event.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-muted">
          <span>{speedRange.min} km/h</span>
          <span>{speedRange.max} km/h</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">KERS ab</span>
          <span className="font-mono-tech text-foreground">{config.kersMinSpeed} km/h</span>
        </div>
        <input
          type="range"
          min={0}
          max={25}
          step={1}
          value={config.kersMinSpeed}
          disabled={disabled || isGenerating}
          onChange={(event) => updateConfig('kersMinSpeed', Number(event.target.value))}
          className="w-full accent-accent"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Beschleunigung</span>
          <span className="font-mono-tech text-foreground">{config.customAcceleration} %</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={config.customAcceleration}
          disabled={disabled || isGenerating}
          onChange={(event) =>
            updateConfig('customAcceleration', Number(event.target.value))
          }
          className="w-full accent-accent"
        />
      </div>

      <div className="grid gap-2">
        <ToggleRow
          label="Tempomat"
          description="Cruise Control in der Firmware aktivieren"
          checked={config.cruiseControl}
          disabled={disabled || isGenerating}
          onChange={(value) => updateConfig('cruiseControl', value)}
        />
        <ToggleRow
          label="Sportmodus"
          description="Sportmodus freischalten"
          checked={config.sportsMode}
          disabled={disabled || isGenerating}
          onChange={(value) => updateConfig('sportsMode', value)}
        />
        <ToggleRow
          label="Eco-Modus"
          description="Eco-Modus konfigurieren"
          checked={config.ecoMode}
          disabled={disabled || isGenerating}
          onChange={(value) => updateConfig('ecoMode', value)}
        />
        <ToggleRow
          label="Region-Lock entfernen"
          description="Regionsbyte auf 0x00 setzen"
          checked={config.removeRegionLock}
          disabled={disabled || isGenerating}
          onChange={(value) => updateConfig('removeRegionLock', value)}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <Cpu className="h-3.5 w-3.5" aria-hidden />
          Live-Vorschau
        </div>
        <ul className="space-y-2">
          {activePreview.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2 text-xs transition-colors duration-300"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground">{item.label}</span>
                <span className="font-mono-tech text-accent">{item.value}</span>
              </div>
              <p className="mt-1 font-mono-tech text-[10px] text-muted">{item.offset}</p>
            </li>
          ))}
        </ul>
      </div>

      {validation.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          {validation.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {warning}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 transition-opacity duration-300">{error}</p>
      )}

      {generatedSha256 && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-400 transition-all duration-300">
          <p className="font-semibold">
            Patch generiert — {patchCount} Felder geschrieben
          </p>
          <p className="mt-1 font-mono-tech text-[10px] text-muted break-all">
            SHA256: {generatedSha256}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={disabled || isGenerating || !validation.valid || !licenseActivated}
        className={[
          'flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all duration-300',
          disabled || isGenerating || !validation.valid || !licenseActivated
            ? 'cursor-not-allowed border-border bg-surface-elevated text-muted'
            : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:shadow-[0_0_20px_rgba(0,212,255,0.12)]',
        ].join(' ')}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden />
        ) : (
          <Wrench className="h-4 w-4" aria-hidden />
        )}
        {isGenerating ? 'Patch wird generiert…' : 'Patch generieren'}
      </button>
    </section>
  )
}
