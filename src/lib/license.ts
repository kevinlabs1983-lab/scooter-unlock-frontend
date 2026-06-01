import { USE_MOCK } from './ble/constants.ts'
import { computeSha256 } from './firmware-loader.ts'
import {
  patchFirmware,
  type PatchConfig,
} from './firmware-patcher.ts'

export const MOCK_LICENSE_KEY = 'NB30-TEST-1234-MOCK'

export const MOCK_LICENSE_PATCH_CONFIG: PatchConfig = {
  speedLimit: 35,
  kersMinSpeed: 10,
  cruiseControl: true,
  sportsMode: true,
  ecoMode: true,
  removeRegionLock: true,
  customAcceleration: 80,
}

const LICENSE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

const MOCK_FIRMWARE_MODEL = 'g30'
const MOCK_FIRMWARE_VERSION = '1.7.3'
const MOCK_FIRMWARE_SIZE = 0x1300

export interface LicenseValidationResult {
  valid: boolean
  isMock: boolean
  patchConfig?: PatchConfig
  error?: string
}

export interface LicenseActivationResult {
  activated: boolean
  licenseKey: string
  isMock: boolean
  patchConfig?: PatchConfig
}

export function formatLicenseInput(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16)
  const groups = cleaned.match(/.{1,4}/g) ?? []
  return groups.join('-')
}

export function isValidLicenseFormat(value: string): boolean {
  return LICENSE_PATTERN.test(value)
}

export function isMockLicense(licenseKey: string): boolean {
  return USE_MOCK && licenseKey === MOCK_LICENSE_KEY
}

export function validateLicense(licenseKey: string): LicenseValidationResult {
  if (!isValidLicenseFormat(licenseKey)) {
    return {
      valid: false,
      isMock: false,
      error: 'Ungültiges Format — XXXX-XXXX-XXXX-XXXX',
    }
  }

  if (isMockLicense(licenseKey)) {
    return {
      valid: true,
      isMock: true,
      patchConfig: MOCK_LICENSE_PATCH_CONFIG,
    }
  }

  return { valid: true, isMock: false }
}

export function activateLicense(licenseKey: string): LicenseActivationResult {
  const validation = validateLicense(licenseKey)

  if (!validation.valid) {
    return { activated: false, licenseKey, isMock: false }
  }

  return {
    activated: true,
    licenseKey,
    isMock: validation.isMock,
    patchConfig: validation.patchConfig,
  }
}

export async function prepareMockFlashFirmware(
  config: PatchConfig = MOCK_LICENSE_PATCH_CONFIG,
): Promise<{ blob: Uint8Array; sha256: string; config: PatchConfig }> {
  const original = new Uint8Array(MOCK_FIRMWARE_SIZE).fill(0xff)
  const blob = patchFirmware(original, MOCK_FIRMWARE_MODEL, MOCK_FIRMWARE_VERSION, config)
  const sha256 = await computeSha256(blob)

  return { blob, sha256, config }
}

export function isMockLicenseMode(): boolean {
  return USE_MOCK
}
