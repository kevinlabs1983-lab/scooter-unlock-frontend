/** G30 / Max — Protocol 2 mit Magic 0x55 0xAA */
export const PROTOCOL_G30 = 'g30' as const

/** Max G3 / neuere Modelle — Encryption2 mit Magic 0x5A 0xA5 */
export const PROTOCOL_ENCRYPTION2 = 'encryption2' as const

export type NinebotProtocol = typeof PROTOCOL_G30 | typeof PROTOCOL_ENCRYPTION2

export const MAGIC_G30 = [0x55, 0xaa] as const
export const MAGIC_ENCRYPTION2 = [0x5a, 0xa5] as const

/** G30 Handshake-Kommandos (0x55 0xAA Protokoll) */
export const CMD_G30 = {
  PRE_COMM: 0x65,
  SET_PWD: 0x64,
  AUTH: 0x67,
} as const

/** Encryption2 Handshake-Kommandos (Max G3) */
export const CMD_E2 = {
  PRE_COMM: 0x5b,
  SET_PWD: 0x5c,
  AUTH: 0x5d,
} as const

/** Board-Adressen — BLE/ESC/BMS identisch, App-Adresse unterscheidet sich */
export const BOARD = {
  BLE: 0x3e,
  ESC: 0x3d,
  BMS: 0x3c,
} as const

export const APP_ADDR = {
  [PROTOCOL_G30]: 0x3b,
  [PROTOCOL_ENCRYPTION2]: 0x04,
} as const

export function detectProtocolFromWire(buffer: Uint8Array): NinebotProtocol | null {
  if (buffer.length < 2) {
    return null
  }
  if (buffer[0] === MAGIC_G30[0] && buffer[1] === MAGIC_G30[1]) {
    return PROTOCOL_G30
  }
  if (buffer[0] === MAGIC_ENCRYPTION2[0] && buffer[1] === MAGIC_ENCRYPTION2[1]) {
    return PROTOCOL_ENCRYPTION2
  }
  return null
}
