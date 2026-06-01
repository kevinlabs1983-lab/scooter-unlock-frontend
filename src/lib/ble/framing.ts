const MAGIC = [0x55, 0xaa] as const

/**
 * Berechnet die 16-Bit-Checksumme (Little-Endian) für Ninebot-Protokoll 2.
 *
 * Summiert alle übergebenen Bytes (typischerweise von LEN bis Ende DATA),
 * bildet dann `(~sum + 1) & 0xFFFF` und gibt CK0 (Low) und CK1 (High) zurück.
 *
 * @param bytes - Bytefolge ab LEN-Feld bis einschließlich letztem DATA-Byte
 * @returns Tupel `[CK0, CK1]` in Little-Endian-Reihenfolge
 */
export function calculateChecksum(bytes: Uint8Array): [number, number] {
  let sum = 0
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xffff
  }
  const checksum = (~sum + 1) & 0xffff
  return [checksum & 0xff, (checksum >> 8) & 0xff]
}

/**
 * Erstellt einen vollständigen Ninebot BLE-Frame (Protokoll 2).
 *
 * Frame-Aufbau: `[0x55, 0xAA, LEN, DEST, SRC, CMD, ...DATA, CK0, CK1]`
 * LEN zählt DEST, SRC, CMD und alle DATA-Bytes (ohne Checksum).
 *
 * @param dest - Ziel-Adresse (z. B. `0x3E` für BLE-Board)
 * @param src - Quell-Adresse (z. B. `0x3B` für App)
 * @param cmd - Kommando-Byte
 * @param data - Payload
 * @returns Fertiger Frame inkl. Magic-Bytes und Checksum
 */
export function buildFrame(
  dest: number,
  src: number,
  cmd: number,
  data: Uint8Array,
): Uint8Array {
  const len = 3 + data.length
  const checksumInput = new Uint8Array(1 + len)
  checksumInput[0] = len
  checksumInput[1] = dest
  checksumInput[2] = src
  checksumInput[3] = cmd
  checksumInput.set(data, 4)

  const [ck0, ck1] = calculateChecksum(checksumInput)

  const frame = new Uint8Array(2 + 1 + len + 2)
  frame[0] = MAGIC[0]
  frame[1] = MAGIC[1]
  frame[2] = len
  frame[3] = dest
  frame[4] = src
  frame[5] = cmd
  frame.set(data, 6)
  frame[6 + data.length] = ck0
  frame[7 + data.length] = ck1

  return frame
}

/**
 * Parst und validiert einen eingehenden Ninebot BLE-Frame (Protokoll 2).
 *
 * Prüft Magic-Bytes (`0x55 0xAA`), Frame-Länge und Checksum.
 * Gibt `null` zurück, wenn der Frame ungültig oder unvollständig ist.
 *
 * @param raw - Rohe Frame-Bytes vom Scooter
 * @returns Geparste Felder `{ dest, src, cmd, data }` oder `null` bei Fehler
 */
export function parseFrame(
  raw: Uint8Array,
): { dest: number; src: number; cmd: number; data: Uint8Array } | null {
  if (raw.length < 7 || raw[0] !== MAGIC[0] || raw[1] !== MAGIC[1]) {
    return null
  }

  const len = raw[2]
  const frameLength = 2 + 1 + len + 2

  if (raw.length < frameLength || len < 3) {
    return null
  }

  const dest = raw[3]
  const src = raw[4]
  const cmd = raw[5]
  const dataLength = len - 3

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

  const data = raw.slice(6, 6 + dataLength)
  return { dest, src, cmd, data }
}
