import type { FlashTarget } from './protocol/firmware.ts'

export const FIRMWARE_BASE_URL = 'https://firmware.scooterhacking.org'

export type FirmwareComponent = 'DRV' | 'BLE' | 'BMS'

export type FirmwareModelId = 'g30' | 'g2' | 'f2' | 'f3'

export interface CatalogVersion {
  /** Anzeige-Version (Dropdown-Wert) */
  id: string
  /** Dateiname auf dem Server */
  file: string
  /** Optional: bekannter SHA256-Hash (hex, lowercase) */
  sha256?: string
}

export interface FirmwareModelCatalog {
  label: string
  slug: string
  components: Partial<Record<FirmwareComponent, CatalogVersion[]>>
}

/** Katalog mit Download-Pfaden auf firmware.scooterhacking.org */
export const FIRMWARE_CATALOG: Record<FirmwareModelId, FirmwareModelCatalog> = {
  g30: {
    label: 'Ninebot Max G30 / G30D',
    slug: 'max',
    components: {
      DRV: [
        { id: '1.6.3', file: '1.6.3.bin' },
        { id: '1.6.0', file: '1.6.0.bin' },
        { id: '1.5.4', file: '1.5.4.bin' },
        { id: '1.5.1', file: '1.5.1.bin' },
        { id: '1.4.5', file: '1.4.5.bin' },
        { id: '1.2.6', file: '1.2.6.bin' },
        { id: '1.6.13 (Compat)', file: '1.6.13 (Compat).bin' },
        { id: '1.8.11 (Compat)', file: '1.8.11 (Compat).bin' },
      ],
      BLE: [
        { id: '1.1.7', file: '1.1.7.bin' },
        { id: '1.1.4', file: '1.1.4.bin' },
        { id: '1.1.3', file: '1.1.3.bin' },
        { id: '1.1.0', file: '1.1.0.bin' },
        { id: '1.1.7 (Compat)', file: '1.1.7 (Compat).bin' },
      ],
      BMS: [
        { id: '1.7.4.5', file: '1.7.4.5.bin' },
        { id: '1.5.8', file: '1.5.8.bin' },
        { id: '1.5.6', file: '1.5.6.bin' },
        { id: '1.5.5', file: '1.5.5.bin' },
        { id: '1.5.3', file: '1.5.3.bin' },
        { id: '1.3.4', file: '1.3.4.bin' },
      ],
    },
  },
  g2: {
    label: 'Ninebot G2 / G2D',
    slug: 'g2',
    components: {
      DRV: [
        { id: '1.11.1 (Compat)', file: '1.11.1 (Compat).bin' },
        { id: '1.7.8 (Compat)', file: '1.7.8 (Compat).bin' },
        { id: '1.7.0 (Compat)', file: '1.7.0 (Compat).bin' },
        { id: '1.5.1 (Compat)', file: '1.5.1 (Compat).bin' },
        { id: '1.4.8 (Compat)', file: '1.4.8 (Compat).bin' },
        { id: '1.4.4 (Compat)', file: '1.4.4 (Compat).bin' },
      ],
      BLE: [
        { id: '1.11.0', file: '1.11.0.bin' },
        { id: '1.7.8', file: '1.7.8.bin' },
        { id: '1.6.10', file: '1.6.10.bin' },
      ],
      BMS: [
        { id: '1.7.5.7', file: '1.7.5.7.bin' },
        { id: '1.7.5.5', file: '1.7.5.5.bin' },
        { id: '1.7.5.4', file: '1.7.5.4.bin' },
        { id: '1.7.5.3', file: '1.7.5.3.bin' },
      ],
    },
  },
  f2: {
    label: 'Ninebot F2 / F2 Plus / F2 Pro',
    slug: 'f2',
    components: {
      DRV: [
        { id: '1.7.8 (Compat)', file: '1.7.8 (Compat).bin' },
        { id: '1.4.15 (Compat)', file: '1.4.15 (Compat).bin' },
      ],
      // BLE-Firmware liegt auf dem Server derzeit nicht unter f2/BLE
    },
  },
  f3: {
    label: 'Ninebot F3 / F3 Pro',
    slug: 'f',
    components: {
      DRV: [
        { id: '5.8.14 (Compat)', file: '5.8.14 (Compat).bin' },
        { id: '5.8.4 (Compat)', file: '5.8.4 (Compat).bin' },
        { id: '5.4.9', file: '5.4.9.bin' },
        { id: '5.4.8', file: '5.4.8.bin' },
        { id: '5.3.7', file: '5.3.7.bin' },
        { id: '5.3.6', file: '5.3.6.bin' },
        { id: '5.3.4', file: '5.3.4.bin' },
        { id: '5.3.3', file: '5.3.3.bin' },
      ],
      BLE: [{ id: '3.0.7', file: '3.0.7.bin' }],
    },
  },
}

export interface FetchFirmwareOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export interface FetchFirmwareResult {
  data: Uint8Array
  sha256: string
  verified: boolean
  url: string
}

export class FirmwareChecksumError extends Error {
  expected: string
  actual: string

  constructor(message: string, expected: string, actual: string) {
    super(message)
    this.name = 'FirmwareChecksumError'
    this.expected = expected
    this.actual = actual
  }
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer
}

export function getModelCatalog(model: string): FirmwareModelCatalog | undefined {
  return FIRMWARE_CATALOG[model as FirmwareModelId]
}

export function listModels(): { id: FirmwareModelId; label: string }[] {
  return Object.entries(FIRMWARE_CATALOG).map(([id, entry]) => ({
    id: id as FirmwareModelId,
    label: entry.label,
  }))
}

export function listComponents(model: string): FirmwareComponent[] {
  const catalog = getModelCatalog(model)
  if (!catalog) {
    return []
  }
  return Object.keys(catalog.components) as FirmwareComponent[]
}

export function listVersions(
  model: string,
  component: FirmwareComponent,
): CatalogVersion[] {
  const catalog = getModelCatalog(model)
  return catalog?.components[component] ?? []
}

export function buildFirmwareUrl(
  model: string,
  component: FirmwareComponent,
  version: string,
): string {
  const catalog = getModelCatalog(model)
  if (!catalog) {
    throw new Error(`Unbekanntes Modell: ${model}`)
  }

  const versions = catalog.components[component]
  if (!versions?.length) {
    throw new Error(`Keine ${component}-Firmware für ${catalog.label}`)
  }

  const entry = versions.find((item) => item.id === version)
  if (!entry) {
    throw new Error(`Version ${version} nicht im Katalog`)
  }

  const encodedFile = entry.file
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return `${FIRMWARE_BASE_URL}/${catalog.slug}/${component}/${encodedFile}`
}

export async function computeSha256(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function fetchExpectedSha256(firmwareUrl: string): Promise<string | null> {
  const sidecarUrls = [`${firmwareUrl}.sha256`, `${firmwareUrl}.sha256.txt`]

  for (const url of sidecarUrls) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        continue
      }
      const text = (await response.text()).trim()
      const match = text.match(/[a-fA-F0-9]{64}/)
      if (match) {
        return match[0].toLowerCase()
      }
    } catch {
      // Sidecar optional
    }
  }

  return null
}

async function validateFirmwareChecksum(
  data: Uint8Array,
  expectedFromCatalog: string | undefined,
  firmwareUrl: string,
): Promise<{ sha256: string; verified: boolean }> {
  const actual = await computeSha256(data)
  const expectedSidecar = await fetchExpectedSha256(firmwareUrl)
  const expected = (expectedFromCatalog ?? expectedSidecar)?.toLowerCase()

  if (expected && expected !== actual) {
    throw new FirmwareChecksumError(
      'SHA256-Checksum der Firmware stimmt nicht überein',
      expected,
      actual,
    )
  }

  return { sha256: actual, verified: Boolean(expected) }
}

async function readResponseWithProgress(
  response: Response,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const total = Number(response.headers.get('content-length') ?? 0)
  const reader = response.body?.getReader()

  if (!reader) {
    const buffer = await response.arrayBuffer()
    onProgress?.(100)
    return new Uint8Array(buffer)
  }

  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (value) {
      chunks.push(value)
      received += value.length
      if (total > 0) {
        onProgress?.(Math.min(100, Math.round((received / total) * 100)))
      }
    }
  }

  const data = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }

  onProgress?.(100)
  return data
}

/**
 * Lädt eine .bin-Firmware vom ScooterHacking-Mirror und validiert SHA256.
 */
export async function fetchFirmware(
  model: string,
  component: FirmwareComponent,
  version: string,
  options: FetchFirmwareOptions = {},
): Promise<Uint8Array> {
  const result = await fetchFirmwareWithMeta(model, component, version, options)
  return result.data
}

export async function fetchFirmwareWithMeta(
  model: string,
  component: FirmwareComponent,
  version: string,
  options: FetchFirmwareOptions = {},
): Promise<FetchFirmwareResult> {
  const catalog = getModelCatalog(model)
  const entry = listVersions(model, component).find((item) => item.id === version)

  if (!catalog || !entry) {
    throw new Error('Firmware-Eintrag nicht gefunden')
  }

  const url = buildFirmwareUrl(model, component, version)
  const response = await fetch(url, { signal: options.signal })

  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen (${response.status})`)
  }

  const data = await readResponseWithProgress(response, options.onProgress)

  if (data.length === 0) {
    throw new Error('Heruntergeladene Firmware ist leer')
  }

  const { sha256, verified } = await validateFirmwareChecksum(
    data,
    entry.sha256,
    url,
  )

  return { data, sha256, verified, url }
}

/**
 * Validiert lokale Firmware-Daten per SHA256 (optional gegen erwarteten Hash).
 */
export async function validateLocalFirmware(
  data: Uint8Array,
  expectedSha256?: string,
): Promise<{ sha256: string; verified: boolean }> {
  const sha256 = await computeSha256(data)

  if (expectedSha256 && expectedSha256.toLowerCase() !== sha256) {
    throw new FirmwareChecksumError(
      'SHA256 der lokalen Datei stimmt nicht überein',
      expectedSha256.toLowerCase(),
      sha256,
    )
  }

  return { sha256, verified: Boolean(expectedSha256) }
}

/** Mappt Firmware-Komponente auf Flash-Ziel-Board. */
export function componentToFlashTarget(component: FirmwareComponent): FlashTarget {
  return component === 'DRV' ? 'ESC' : component
}
