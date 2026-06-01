import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { Download, FileUp, Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import {
  componentToFlashTarget,
  computeSha256,
  fetchFirmwareWithMeta,
  FirmwareChecksumError,
  listComponents,
  listModels,
  listVersions,
  type FirmwareComponent,
  type FirmwareModelId,
} from '../lib/firmware-loader.ts'
import type { FlashTarget } from '../lib/protocol/firmware.ts'

export interface LoadedFirmware {
  blob: Uint8Array
  sha256: string
  verified: boolean
  source: 'remote' | 'local'
  model?: string
  component?: FirmwareComponent
  version?: string
  flashTarget: FlashTarget
}

interface FirmwareSelectorProps {
  onFirmwareLoaded: (firmware: LoadedFirmware) => void
  disabled?: boolean
}

export function FirmwareSelector({ onFirmwareLoaded, disabled }: FirmwareSelectorProps) {
  const models = useMemo(() => listModels(), [])

  const [model, setModel] = useState<FirmwareModelId>('g30')
  const [component, setComponent] = useState<FirmwareComponent>('DRV')
  const [version, setVersion] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedInfo, setLoadedInfo] = useState<{
    sha256: string
    verified: boolean
    bytes: number
    source: 'remote' | 'local'
  } | null>(null)

  const components = useMemo(() => listComponents(model), [model])
  const versions = useMemo(() => listVersions(model, component), [model, component])

  useEffect(() => {
    if (!components.includes(component)) {
      setComponent(components[0] ?? 'DRV')
    }
  }, [components, component])

  useEffect(() => {
    setVersion(versions[0]?.id ?? '')
  }, [versions])

  const handleDownload = async () => {
    if (!version) {
      return
    }

    setError(null)
    setLoadedInfo(null)
    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      const result = await fetchFirmwareWithMeta(model, component, version, {
        onProgress: setDownloadProgress,
      })

      const firmware: LoadedFirmware = {
        blob: result.data,
        sha256: result.sha256,
        verified: result.verified,
        source: 'remote',
        model,
        component,
        version,
        flashTarget: componentToFlashTarget(component),
      }

      setLoadedInfo({
        sha256: result.sha256,
        verified: result.verified,
        bytes: result.data.length,
        source: 'remote',
      })
      onFirmwareLoaded(firmware)
    } catch (err) {
      const message =
        err instanceof FirmwareChecksumError
          ? `Checksum-Fehler — erwartet ${err.expected.slice(0, 12)}…`
          : err instanceof Error
            ? err.message
            : String(err)
      setError(message)
    } finally {
      setIsDownloading(false)
    }
  }

  const loadLocalFile = useCallback(
    async (file: File) => {
      setError(null)
      setLoadedInfo(null)

      if (!file.name.toLowerCase().endsWith('.bin')) {
        setError('Nur .bin-Dateien werden unterstützt')
        return
      }

      try {
        const buffer = await file.arrayBuffer()
        const blob = new Uint8Array(buffer)
        const sha256 = await computeSha256(blob)

        const firmware: LoadedFirmware = {
          blob,
          sha256,
          verified: true,
          source: 'local',
          flashTarget: componentToFlashTarget(component),
          component,
          model,
        }

        setLoadedInfo({
          sha256,
          verified: true,
          bytes: blob.length,
          source: 'local',
        })
        onFirmwareLoaded(firmware)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [component, model, onFirmwareLoaded],
  )

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    if (disabled || isDownloading) {
      return
    }
    const file = event.dataTransfer.files[0]
    if (file) {
      void loadLocalFile(file)
    }
  }

  return (
    <section className="animate-fade-in space-y-4 rounded-xl border border-border bg-surface p-5 transition-all duration-300">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Firmware auswählen</h2>
        <p className="mt-1 text-xs text-muted">
          Aus dem ScooterHacking-Katalog laden oder lokale .bin per Drag &amp; Drop
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-muted">Modell</span>
          <select
            value={model}
            disabled={disabled || isDownloading}
            onChange={(event) => setModel(event.target.value as FirmwareModelId)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none transition-colors duration-300 focus:border-accent/50"
          >
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-muted">Komponente</span>
          <select
            value={component}
            disabled={disabled || isDownloading || components.length === 0}
            onChange={(event) =>
              setComponent(event.target.value as FirmwareComponent)
            }
            className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none transition-colors duration-300 focus:border-accent/50"
          >
            {components.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-muted">Firmware-Version</span>
          <select
            value={version}
            disabled={disabled || isDownloading || versions.length === 0}
            onChange={(event) => setVersion(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 font-mono-tech text-sm text-foreground outline-none transition-colors duration-300 focus:border-accent/50"
          >
            {versions.length === 0 ? (
              <option value="">Keine Versionen verfügbar</option>
            ) : (
              versions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={disabled || isDownloading || !version}
        className={[
          'flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all duration-300',
          disabled || isDownloading || !version
            ? 'cursor-not-allowed border-border bg-surface-elevated text-muted'
            : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20',
        ].join(' ')}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin-slow" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {isDownloading ? 'Lädt herunter…' : 'Herunterladen'}
      </button>

      {(isDownloading || downloadProgress > 0) && (
        <div className="space-y-1 transition-all duration-300">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Download</span>
            <span className="font-mono-tech text-accent">{downloadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={[
          'rounded-lg border border-dashed px-4 py-8 text-center transition-all duration-300',
          isDragOver
            ? 'border-accent bg-accent/5'
            : 'border-border bg-surface-elevated/40 hover:border-accent/30',
          disabled || isDownloading ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <FileUp className="mx-auto h-8 w-8 text-accent/70" aria-hidden />
        <p className="mt-2 text-sm text-foreground">Lokale .bin hier ablegen</p>
        <p className="mt-1 text-xs text-muted">oder</p>
        <label className="mt-3 inline-block cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent">
          Datei wählen
          <input
            type="file"
            accept=".bin"
            className="hidden"
            disabled={disabled || isDownloading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void loadLocalFile(file)
              }
            }}
          />
        </label>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-xs text-red-400 transition-opacity duration-300">
          <ShieldX className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {loadedInfo && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs transition-all duration-300">
          <div className="flex items-center gap-2 text-green-400">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {loadedInfo.source === 'remote' && loadedInfo.verified
              ? 'SHA256 verifiziert'
              : loadedInfo.source === 'remote'
                ? 'SHA256 berechnet (kein Referenz-Hash)'
                : 'Lokale Datei geladen'}
          </div>
          <p className="mt-1 font-mono-tech text-[10px] text-muted break-all">
            {loadedInfo.sha256}
          </p>
          <p className="mt-1 text-muted">
            {loadedInfo.bytes.toLocaleString('de-DE')} Bytes
          </p>
        </div>
      )}
    </section>
  )
}
