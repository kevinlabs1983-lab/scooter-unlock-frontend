import { calculateChecksum } from './framing.ts'
import { MAGIC_ENCRYPTION2 } from './protocol-types.ts'

export interface Encryption2Frame {
  btId: number
  targetId: number
  cmd: number
  index: number
  data: Uint8Array
}

/**
 * Encryption2-Klartext-Frame (Max G3):
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
