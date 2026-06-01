import { isMockLicense } from './license.ts'

export interface PatchConfig {
  speedLimit: number
  kersMinSpeed: number
  cruiseControl: boolean
  sportsMode: boolean
  ecoMode: boolean
  removeRegionLock: boolean
  customAcceleration: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface PatchPreviewItem {
  id: keyof PatchConfig | 'regionByte'
  label: string
  value: string
  offset: string
  active: boolean
}

interface PatchFieldDefinition {
  offset: number
  size: 1 | 2 | 4
  label: string
  encode: (config: PatchConfig) => number
  isActive?: (config: PatchConfig) => boolean
}

interface ModelPatchProfile {
  speedLimitMax: number
  kersMinSpeedMax: number
  minFirmwareSize: number
  versions?: Record<string, Partial<Record<PatchFieldKey, Omit<PatchFieldDefinition, 'label' | 'encode' | 'isActive'>>>>
  fields: Record<PatchFieldKey, PatchFieldDefinition>
}

type PatchFieldKey =
  | 'speedLimit'
  | 'kersMinSpeed'
  | 'cruiseControl'
  | 'sportsMode'
  | 'ecoMode'
  | 'customAcceleration'
  | 'regionByte'

const BOOL_ON = 0x01
const BOOL_OFF = 0x00

/** Bekannte Offsets — G30 DRV 1.7.3 (ScooterHacking-Referenz). */
export const G30_PATCHES = {
  speedLimit: {
    offset: 0x127a,
    size: 2 as const,
    encode: (kmh: number) => Math.round((kmh * 1000) / 3.6),
  },
  kersMinSpeed: {
    offset: 0x1282,
    size: 2 as const,
    encode: (kmh: number) => Math.round(kmh * 100),
  },
  regionByte: {
    offset: 0x1290,
    size: 1 as const,
    encode: () => 0x00,
  },
} as const

function encodeSpeedLimitRaw(kmh: number): number {
  return G30_PATCHES.speedLimit.encode(kmh)
}

function encodeKersMinSpeedRaw(kmh: number): number {
  return G30_PATCHES.kersMinSpeed.encode(kmh)
}

const G30_FIELD_LAYOUT: Record<PatchFieldKey, PatchFieldDefinition> = {
  speedLimit: {
    offset: G30_PATCHES.speedLimit.offset,
    size: G30_PATCHES.speedLimit.size,
    label: 'Speed-Limit',
    encode: (config) => encodeSpeedLimitRaw(config.speedLimit),
  },
  kersMinSpeed: {
    offset: G30_PATCHES.kersMinSpeed.offset,
    size: G30_PATCHES.kersMinSpeed.size,
    label: 'KERS ab',
    encode: (config) => encodeKersMinSpeedRaw(config.kersMinSpeed),
  },
  cruiseControl: {
    offset: 0x1286,
    size: 1,
    label: 'Tempomat',
    encode: (config) => (config.cruiseControl ? BOOL_ON : BOOL_OFF),
  },
  sportsMode: {
    offset: 0x1288,
    size: 1,
    label: 'Sportmodus',
    encode: (config) => (config.sportsMode ? BOOL_ON : BOOL_OFF),
  },
  ecoMode: {
    offset: 0x128a,
    size: 1,
    label: 'Eco-Modus',
    encode: (config) => (config.ecoMode ? BOOL_ON : BOOL_OFF),
  },
  customAcceleration: {
    offset: 0x128c,
    size: 1,
    label: 'Beschleunigung',
    encode: (config) => Math.round(config.customAcceleration),
  },
  regionByte: {
    offset: G30_PATCHES.regionByte.offset,
    size: G30_PATCHES.regionByte.size,
    label: 'Region-Lock',
    encode: () => G30_PATCHES.regionByte.encode(),
    isActive: (config) => config.removeRegionLock,
  },
}

const G2_FIELD_LAYOUT: Record<PatchFieldKey, PatchFieldDefinition> = {
  ...G30_FIELD_LAYOUT,
  speedLimit: {
    ...G30_FIELD_LAYOUT.speedLimit,
    offset: 0x14b2,
  },
  kersMinSpeed: {
    ...G30_FIELD_LAYOUT.kersMinSpeed,
    offset: 0x14ba,
  },
  cruiseControl: {
    ...G30_FIELD_LAYOUT.cruiseControl,
    offset: 0x14be,
  },
  sportsMode: {
    ...G30_FIELD_LAYOUT.sportsMode,
    offset: 0x14c0,
  },
  ecoMode: {
    ...G30_FIELD_LAYOUT.ecoMode,
    offset: 0x14c2,
  },
  customAcceleration: {
    ...G30_FIELD_LAYOUT.customAcceleration,
    offset: 0x14c4,
  },
  regionByte: {
    ...G30_FIELD_LAYOUT.regionByte,
    offset: 0x14c8,
  },
}

const PATCH_PROFILES: Record<string, ModelPatchProfile> = {
  g30: {
    speedLimitMax: 35,
    kersMinSpeedMax: 25,
    minFirmwareSize: 0x1300,
    versions: {
      '1.7.3': {},
      '1.6.3': {},
      '1.6.0': {},
    },
    fields: G30_FIELD_LAYOUT,
  },
  g2: {
    speedLimitMax: 45,
    kersMinSpeedMax: 30,
    minFirmwareSize: 0x1600,
    versions: {
      '1.11.1 (Compat)': {},
      '1.7.8 (Compat)': {},
    },
    fields: G2_FIELD_LAYOUT,
  },
  f2: {
    speedLimitMax: 35,
    kersMinSpeedMax: 25,
    minFirmwareSize: 0x1300,
    fields: G30_FIELD_LAYOUT,
  },
  f3: {
    speedLimitMax: 45,
    kersMinSpeedMax: 30,
    minFirmwareSize: 0x1800,
    fields: G2_FIELD_LAYOUT,
  },
}

export const DEFAULT_PATCH_CONFIG: PatchConfig = {
  speedLimit: 25,
  kersMinSpeed: 6,
  cruiseControl: false,
  sportsMode: false,
  ecoMode: false,
  removeRegionLock: false,
  customAcceleration: 50,
}

function normalizeModel(model: string): string {
  return model.trim().toLowerCase()
}

function normalizeVersion(version: string): string {
  return version.trim()
}

function getProfile(model: string): ModelPatchProfile | undefined {
  return PATCH_PROFILES[normalizeModel(model)]
}

function resolveFields(model: string, version: string): Record<PatchFieldKey, PatchFieldDefinition> {
  const profile = getProfile(model)
  if (!profile) {
    throw new Error(`Kein Patch-Profil für Modell „${model}“`)
  }

  const versionOverrides = profile.versions?.[normalizeVersion(version)] ?? {}
  const merged = { ...profile.fields }

  for (const key of Object.keys(versionOverrides) as PatchFieldKey[]) {
    const override = versionOverrides[key]
    if (override && merged[key]) {
      merged[key] = { ...merged[key], ...override }
    }
  }

  return merged
}

function writeValue(buffer: Uint8Array, offset: number, size: number, value: number): void {
  if (offset < 0 || offset + size > buffer.length) {
    throw new Error(
      `Patch-Offset 0x${offset.toString(16)} liegt außerhalb der Firmware (${buffer.length} Bytes)`,
    )
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  if (size === 1) {
    buffer[offset] = value & 0xff
    return
  }

  if (size === 2) {
    view.setUint16(offset, value & 0xffff, true)
    return
  }

  view.setUint32(offset, value >>> 0, true)
}

function formatEncodedValue(size: number, value: number): string {
  if (size === 1) {
    return `0x${(value & 0xff).toString(16).padStart(2, '0').toUpperCase()}`
  }

  if (size === 2) {
    return `0x${(value & 0xffff).toString(16).padStart(4, '0').toUpperCase()}`
  }

  return `0x${(value >>> 0).toString(16).padStart(8, '0').toUpperCase()}`
}

function formatConfigValue(key: PatchFieldKey, config: PatchConfig): string {
  switch (key) {
    case 'speedLimit':
      return `${config.speedLimit} km/h`
    case 'kersMinSpeed':
      return `${config.kersMinSpeed} km/h`
    case 'cruiseControl':
      return config.cruiseControl ? 'Aktiv' : 'Aus'
    case 'sportsMode':
      return config.sportsMode ? 'Freigeschaltet' : 'Standard'
    case 'ecoMode':
      return config.ecoMode ? 'Aktiv' : 'Aus'
    case 'customAcceleration':
      return `${config.customAcceleration} %`
    case 'regionByte':
      return config.removeRegionLock ? 'Entfernt (0x00)' : 'Unverändert'
    default:
      return '—'
  }
}

export function getSpeedLimitRange(model: string): { min: number; max: number } {
  const profile = getProfile(model)
  return {
    min: 15,
    max: profile?.speedLimitMax ?? 35,
  }
}

export function validatePatchConfig(config: PatchConfig, model: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const profile = getProfile(model)

  if (!profile) {
    return {
      valid: false,
      errors: [`Modell „${model}“ wird vom Patcher nicht unterstützt`],
      warnings,
    }
  }

  const { min, max } = getSpeedLimitRange(model)

  if (!Number.isFinite(config.speedLimit) || config.speedLimit < min || config.speedLimit > max) {
    errors.push(`Speed-Limit muss zwischen ${min} und ${max} km/h liegen`)
  }

  if (
    !Number.isFinite(config.kersMinSpeed) ||
    config.kersMinSpeed < 0 ||
    config.kersMinSpeed > profile.kersMinSpeedMax
  ) {
    errors.push(`KERS-Mindestgeschwindigkeit muss zwischen 0 und ${profile.kersMinSpeedMax} km/h liegen`)
  }

  if (
    !Number.isFinite(config.customAcceleration) ||
    config.customAcceleration < 0 ||
    config.customAcceleration > 100
  ) {
    errors.push('Beschleunigung muss zwischen 0 und 100 % liegen')
  }

  if (config.speedLimit > 30 && !config.sportsMode) {
    warnings.push('Speed-Limit über 30 km/h — Sportmodus wird empfohlen')
  }

  if (config.removeRegionLock) {
    warnings.push('Region-Lock entfernen kann Garantie und Zulassung beeinflussen')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function describePatchPreview(
  config: PatchConfig,
  model: string,
  version: string,
): PatchPreviewItem[] {
  const fields = resolveFields(model, version)

  return (Object.keys(fields) as PatchFieldKey[]).map((key) => {
    const field = fields[key]
    const active = field.isActive ? field.isActive(config) : true
    const encoded = field.encode(config)

    return {
      id: key,
      label: field.label,
      value: formatConfigValue(key, config),
      offset: `0x${field.offset.toString(16).toUpperCase()} → ${formatEncodedValue(field.size, encoded)}`,
      active,
    }
  })
}

export interface PatchResult {
  data: Uint8Array
  appliedPatches: PatchPreviewItem[]
}

/**
 * Wendet konfigurierte Byte-Patches lokal auf eine Firmware-Kopie an.
 * Das Binary verlässt den Browser erst über `exportPatchedFirmwareViaBackend`.
 */
export function patchFirmware(
  original: Uint8Array,
  model: string,
  version: string,
  config: PatchConfig,
): Uint8Array {
  return patchFirmwareWithMeta(original, model, version, config).data
}

export function patchFirmwareWithMeta(
  original: Uint8Array,
  model: string,
  version: string,
  config: PatchConfig,
): PatchResult {
  const validation = validatePatchConfig(config, model)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' · '))
  }

  const profile = getProfile(model)
  if (!profile) {
    throw new Error(`Kein Patch-Profil für Modell „${model}“`)
  }

  if (original.length < profile.minFirmwareSize) {
    throw new Error(
      `Firmware zu klein für ${model} (${original.length} Bytes, min. ${profile.minFirmwareSize})`,
    )
  }

  const fields = resolveFields(model, version)
  const data = new Uint8Array(original)
  const appliedPatches: PatchPreviewItem[] = []

  for (const key of Object.keys(fields) as PatchFieldKey[]) {
    const field = fields[key]
    const active = field.isActive ? field.isActive(config) : true

    if (!active) {
      continue
    }

    const encoded = field.encode(config)
    writeValue(data, field.offset, field.size, encoded)

    appliedPatches.push({
      id: key,
      label: field.label,
      value: formatConfigValue(key, config),
      offset: `0x${field.offset.toString(16).toUpperCase()} → ${formatEncodedValue(field.size, encoded)}`,
      active: true,
    })
  }

  return { data, appliedPatches }
}

export interface ExportPatchedFirmwareOptions {
  licenseKey: string
  patched: Uint8Array
  model: string
  version: string
  sha256: string
  config: PatchConfig
}

const LICENSE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

function toBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!)
  }
  return btoa(binary)
}

/**
 * Einziger vorgesehener Weg, das gepatchte Binary den Browser zu verlassen.
 * Erfordert einen gültigen Lizenzschlüssel und optional konfigurierte Backend-URL.
 */
export async function exportPatchedFirmwareViaBackend(
  options: ExportPatchedFirmwareOptions,
): Promise<void> {
  const { licenseKey, patched, model, version, sha256, config } = options

  if (isMockLicense(licenseKey)) {
    return
  }

  if (!LICENSE_PATTERN.test(licenseKey)) {
    throw new Error('Gültiger Lizenzschlüssel erforderlich für den Firmware-Export')
  }

  const validation = validatePatchConfig(config, model)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' · '))
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
  if (!apiBase) {
    return
  }

  const response = await fetch(`${apiBase}/api/firmware/patch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `License ${licenseKey}`,
    },
    body: JSON.stringify({
      model,
      version,
      sha256,
      config,
      firmwareBase64: toBase64(patched),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      detail || `Backend-Export fehlgeschlagen (${response.status})`,
    )
  }
}
