import { calculateChecksum } from './framing.ts'
import { CMD_E2, MAGIC_ENCRYPTION2 } from './protocol-types.ts'

/** App/BLE-Quelle (wir) — Encryption2 Plain-Frame */
export const E2_ADDR_APP = 0x3e

/** Dashboard-Ziel — Encryption2 Plain-Frame (Max G3) */
export const E2_ADDR_DASHBOARD = 0x21

export interface Encryption2Frame {
  btId: number
  targetId: number
  cmd: number
  index: number
  data: Uint8Array
}

export interface Encryption2PlainFrame {
  srcAddr: number
  dstAddr: number
  cmd: number
  arg: number
  payload: Uint8Array
}

/**
 * Encryption2 CRC: 0xFFFF XOR (uint16-Summe der Felder).
 * Für PRE_COMM: [bLen, SrcAddr, DstAddr, CMD, ARG] (+ optional Payload).
 */
export function calculateEncryption2XorCrc(fields: Uint8Array): [number, number] {
  let sum = 0
  for (const byte of fields) {
    sum = (sum + byte) & 0xffff
  }
  const crc = (0xffff ^ sum) & 0xffff
  return [crc & 0xff, (crc >> 8) & 0xff]
}

/**
 * Encryption2 Plain-Frame (unverschlüsselt):
 * `[0x5A, 0xA5, bLen, SrcAddr, DstAddr, CMD, ARG, ...payload, CRC_LO, CRC_HI]`
 *
 * bLen = Länge des Payloads (CMD/ARG werden NICHT gezählt).
 */
export function buildEncryption2PlainFrame(
  srcAddr: number,
  dstAddr: number,
  cmd: number,
  arg: number,
  payload: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const bLen = payload.length
  const crcInput = new Uint8Array(5 + bLen)
  crcInput[0] = bLen
  crcInput[1] = srcAddr
  crcInput[2] = dstAddr
  crcInput[3] = cmd
  crcInput[4] = arg
  if (bLen > 0) {
    crcInput.set(payload, 5)
  }

  const [ckLo, ckHi] = calculateEncryption2XorCrc(crcInput)

  const frame = new Uint8Array(9 + bLen)
  frame[0] = MAGIC_ENCRYPTION2[0]
  frame[1] = MAGIC_ENCRYPTION2[1]
  frame[2] = bLen
  frame[3] = srcAddr
  frame[4] = dstAddr
  frame[5] = cmd
  frame[6] = arg
  if (bLen > 0) {
    frame.set(payload, 7)
  }
  frame[7 + bLen] = ckLo
  frame[8 + bLen] = ckHi
  return frame
}

/**
 * PRE_COMM (Encryption2/Gen3) — exakt 9 Bytes, unverschlüsselt:
 * `5A A5 00 3E 21 5B 00 45 FF`
 */
export function buildEncryption2PreCommRequest(): Uint8Array {
  return buildEncryption2PlainFrame(
    E2_ADDR_APP,
    E2_ADDR_DASHBOARD,
    CMD_E2.PRE_COMM,
    0x00,
  )
}

/** Vollständigkeitsprüfung für Encryption2 Plain-Frames (bLen kann 0 sein). */
export function isEncryption2PlainFrameComplete(buffer: Uint8Array): boolean {
  if (
    buffer.length < 9 ||
    buffer[0] !== MAGIC_ENCRYPTION2[0] ||
    buffer[1] !== MAGIC_ENCRYPTION2[1]
  ) {
    return false
  }
  const bLen = buffer[2] ?? 0
  return buffer.length >= 9 + bLen
}

export function parseEncryption2PlainFrame(raw: Uint8Array): Encryption2PlainFrame | null {
  if (
    raw.length < 9 ||
    raw[0] !== MAGIC_ENCRYPTION2[0] ||
    raw[1] !== MAGIC_ENCRYPTION2[1]
  ) {
    return null
  }

  const bLen = raw[2] ?? 0
  const frameLength = 9 + bLen
  if (raw.length < frameLength) {
    return null
  }

  const srcAddr = raw[3] ?? 0
  const dstAddr = raw[4] ?? 0
  const cmd = raw[5] ?? 0
  const arg = raw[6] ?? 0
  const payload = raw.slice(7, 7 + bLen)

  const crcInput = raw.slice(2, 7 + bLen)
  const [ckLo, ckHi] = calculateEncryption2XorCrc(crcInput)
  if (raw[7 + bLen] !== ckLo || raw[8 + bLen] !== ckHi) {
    return null
  }

  return { srcAddr, dstAddr, cmd, arg, payload }
}

/**
 * Parst PRE_COMM-Antwort:
 * `[5A, A5, 1E, 21, 3D, 5B, 01, ...16B Key... ...14B SN...]`
 */
export function parseEncryption2PreCommResponse(raw: Uint8Array): {
  authParam: Uint8Array
  serial: string
} | null {
  const parsed = parseEncryption2PlainFrame(raw)
  if (parsed === null || parsed.cmd !== CMD_E2.PRE_COMM || parsed.payload.length < 30) {
    return null
  }

  return {
    authParam: parsed.payload.slice(0, 16),
    serial: new TextDecoder()
      .decode(parsed.payload.slice(16, 30))
      .replace(/\0/g, ''),
  }
}

/**
 * Verschlüsselte SN-Frames (SET_PWD/AUTH nach PRE_COMM):
 * `[0x5A, 0xA5, LEN, BT_ID, TARGET_ID, CMD, INDEX, ...DATA, CK0, CK1]`
 *
 * LEN zählt BT_ID, TARGET_ID, CMD, INDEX und DATA (ohne Checksum).
 */
export function buildEncryption2Frame(
  btId: number,
  targetId: number,
  cmd: number,
  data: Uint8Array,
  index = 0,
): Uint8Array {
  const len = 4 + data.length
  const checksumInput = new Uint8Array(1 + len)
  checksumInput[0] = len
  checksumInput[1] = btId
  checksumInput[2] = targetId
  checksumInput[3] = cmd
  checksumInput[4] = index
  checksumInput.set(data, 5)

  const [ck0, ck1] = calculateChecksum(checksumInput)

  const frame = new Uint8Array(2 + 1 + len + 2)
  frame[0] = MAGIC_ENCRYPTION2[0]
  frame[1] = MAGIC_ENCRYPTION2[1]
  frame[2] = len
  frame[3] = btId
  frame[4] = targetId
  frame[5] = cmd
  frame[6] = index
  frame.set(data, 7)
  frame[7 + data.length] = ck0
  frame[8 + data.length] = ck1

  return frame
}

export function parseEncryption2Frame(raw: Uint8Array): Encryption2Frame | null {
  if (
    raw.length < 9 ||
    raw[0] !== MAGIC_ENCRYPTION2[0] ||
    raw[1] !== MAGIC_ENCRYPTION2[1]
  ) {
    return null
  }

  const len = raw[2] ?? 0
  const frameLength = 2 + 1 + len + 2

  if (raw.length < frameLength || len < 4) {
    return null
  }

  const btId = raw[3] ?? 0
  const targetId = raw[4] ?? 0
  const cmd = raw[5] ?? 0
  const index = raw[6] ?? 0
  const dataLength = len - 4

  if (dataLength < 0) {
    return null
  }

  const checksumInput = raw.slice(2, 3 + len)
  const [ck0, ck1] = calculateChecksum(checksumInput)
  const frameCk0 = raw[3 + len]
  const frameCk1 = raw[3 + len + 1]

  if (ck0 !== frameCk0 || ck1 !== frameCk1) {
    return null
  }

  const data = raw.slice(7, 7 + dataLength)
  return { btId, targetId, cmd, index, data }
}

/** Kompatibilitäts-Adapter für exchangeFrame (dest/src/cmd/data). */
export function encryption2ToLegacy(parsed: Encryption2Frame): {
  dest: number
  src: number
  cmd: number
  data: Uint8Array
} {
  return {
    dest: parsed.btId,
    src: parsed.targetId,
    cmd: parsed.cmd,
    data: parsed.data,
  }
}
