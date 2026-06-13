import { ADDR } from '../ble/constants.ts'
import { buildProtocolFrame } from '../ble/frame-utils.ts'
import type { SessionState } from '../crypto/handshake.ts'
import {
  BLE_FIRMWARE_VERSION,
  BMS_FIRMWARE_VERSION,
  decodeVersion,
  exchangeFrame,
  readRegister,
  REGISTERS,
} from './commands.ts'

export const CHUNK_SIZE = 16
export const CHUNK_TIMEOUT_MS = 5000
export const MAX_CHUNK_RETRIES = 3

export const CMD_IAP_BEGIN = 0x07
export const CMD_IAP_TRANS = 0x08
export const CMD_IAP_VERIFY = 0x09
export const CMD_IAP_RESET = 0x0a
export const CMD_IAP_ACK = 0x0b

export const IAP_ACK_OK = 0x01

export type FlashTarget = 'BLE' | 'ESC' | 'BMS'

export interface FlashResult {
  success: boolean
  error?: string
  newVersion?: string
}

const TARGET_BOARD: Record<FlashTarget, number> = {
  BLE: ADDR.BLE,
  ESC: ADDR.ESC,
  BMS: ADDR.BMS,
}

const TARGET_VERSION_REGISTER: Record<FlashTarget, number> = {
  BLE: BLE_FIRMWARE_VERSION,
  ESC: REGISTERS.FIRMWARE_VERSION,
  BMS: BMS_FIRMWARE_VERSION,
}

let lastFlashTarget: FlashTarget | null = null
let lastFlashedVersion: string | undefined

function encodeUint32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

function encodeUint16LE(value: number): Uint8Array {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, value & 0xffff, true)
  return bytes
}

function padChunk(data: Uint8Array, offset: number): Uint8Array {
  const chunk = new Uint8Array(CHUNK_SIZE)
  const length = Math.min(CHUNK_SIZE, data.length - offset)
  chunk.set(data.slice(offset, offset + length))
  return chunk
}

function buildIapTransferPayload(sequence: number, chunk: Uint8Array): Uint8Array {
  const payload = new Uint8Array(2 + chunk.length)
  payload.set(encodeUint16LE(sequence), 0)
  payload.set(chunk, 2)
  return payload
}

function isIapAck(response: { cmd: number; data: Uint8Array }): boolean {
  if (response.cmd !== CMD_IAP_ACK) {
    return false
  }
  return response.data.length === 0 || response.data[0] === IAP_ACK_OK
}

async function sendIapCommand(
  session: SessionState,
  board: number,
  cmd: number,
  data: Uint8Array,
): Promise<{ cmd: number; data: Uint8Array }> {
  const frame = buildProtocolFrame(
    session.protocol,
    board,
    cmd,
    data,
    0,
    session.encryption2AppAddr,
  )
  return exchangeFrame(session, frame, CHUNK_TIMEOUT_MS)
}

async function sendIapCommandWithRetry(
  session: SessionState,
  board: number,
  cmd: number,
  data: Uint8Array,
): Promise<{ cmd: number; data: Uint8Array }> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    try {
      const response = await sendIapCommand(session, board, cmd, data)
      if (isIapAck(response)) {
        return response
      }
      lastError = new Error(
        `IAP-Antwort abgelehnt (cmd=0x${response.cmd.toString(16)}, status=0x${(response.data[0] ?? 0).toString(16)})`,
      )
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('IAP-Kommando fehlgeschlagen')
}

async function readTargetFirmwareVersion(
  session: SessionState,
  target: FlashTarget,
): Promise<string> {
  const data = await readRegister(
    session,
    TARGET_BOARD[target],
    TARGET_VERSION_REGISTER[target],
    2,
  )
  return decodeVersion(data)
}

/**
 * Berechnet CRC32 über die Firmware-Daten (Polynom 0xEDB88320).
 */
export function calculateCRC32(data: Uint8Array): number {
  let crc = 0xffffffff

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Liest die Firmware-Version nach einem Flash-Vorgang und vergleicht sie
 * mit der zuletzt gemeldeten Version aus `flashFirmware`.
 */
export async function verifyFirmware(session: SessionState): Promise<boolean> {
  if (!lastFlashTarget || !lastFlashedVersion) {
    return false
  }

  try {
    const currentVersion = await readTargetFirmwareVersion(session, lastFlashTarget)
    return currentVersion === lastFlashedVersion
  } catch {
    return false
  }
}

/**
 * Flasht einen Firmware-Blob per Ninebot IAP (16-Byte-Chunks, CRC32, ACK).
 */
export async function flashFirmware(
  session: SessionState,
  firmwareBlob: Uint8Array,
  target: FlashTarget,
  onProgress: (percent: number, chunk: number, total: number) => void,
  isCancelled?: () => boolean,
): Promise<FlashResult> {
  if (firmwareBlob.length === 0) {
    return { success: false, error: 'Firmware-Blob ist leer' }
  }

  if (isCancelled?.()) {
    return { success: false, error: 'Flash abgebrochen' }
  }

  const board = TARGET_BOARD[target]
  const totalChunks = Math.ceil(firmwareBlob.length / CHUNK_SIZE)
  lastFlashTarget = target
  lastFlashedVersion = undefined

  try {
    await sendIapCommandWithRetry(
      session,
      board,
      CMD_IAP_BEGIN,
      encodeUint32LE(firmwareBlob.length),
    )

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (isCancelled?.()) {
        return { success: false, error: 'Flash abgebrochen' }
      }

      const sequence = chunkIndex + 1
      const chunk = padChunk(firmwareBlob, chunkIndex * CHUNK_SIZE)
      const payload = buildIapTransferPayload(sequence, chunk)

      await sendIapCommandWithRetry(session, board, CMD_IAP_TRANS, payload)

      const percent = Math.round(((chunkIndex + 1) / totalChunks) * 100)
      onProgress(percent, chunkIndex + 1, totalChunks)
    }

    if (isCancelled?.()) {
      return { success: false, error: 'Flash abgebrochen' }
    }

    const crc32 = calculateCRC32(firmwareBlob)
    await sendIapCommandWithRetry(
      session,
      board,
      CMD_IAP_VERIFY,
      encodeUint32LE(crc32),
    )

    try {
      await sendIapCommand(session, board, CMD_IAP_RESET, new Uint8Array([0x01]))
    } catch {
      // Neustart-Bestätigung ist optional — Verify-ACK reicht oft aus
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3000))

    const newVersion = await readTargetFirmwareVersion(session, target)
    lastFlashedVersion = newVersion

    return {
      success: true,
      newVersion,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
