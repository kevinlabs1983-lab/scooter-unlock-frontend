import { buildFrame, parseFrame } from './framing.ts'
import {
  buildEncryption2Frame,
  encryption2ToLegacy,
  parseEncryption2Frame,
} from './framing-encryption2.ts'
import {
  APP_ADDR,
  BOARD,
  type NinebotProtocol,
  PROTOCOL_ENCRYPTION2,
  PROTOCOL_G30,
} from './protocol-types.ts'

export function buildProtocolFrame(
  protocol: NinebotProtocol,
  board: number,
  cmd: number,
  data: Uint8Array,
  index = 0,
  encryption2AppAddr?: number,
): Uint8Array {
  if (protocol === PROTOCOL_ENCRYPTION2) {
    const app = encryption2AppAddr ?? APP_ADDR[PROTOCOL_ENCRYPTION2]
    return buildEncryption2Frame(board, app, cmd, data, index)
  }
  return buildFrame(board, APP_ADDR[PROTOCOL_G30], cmd, data)
}

export function parseProtocolFrame(
  protocol: NinebotProtocol,
  raw: Uint8Array,
): { dest: number; src: number; cmd: number; data: Uint8Array } | null {
  if (protocol === PROTOCOL_ENCRYPTION2) {
    const parsed = parseEncryption2Frame(raw)
    return parsed ? encryption2ToLegacy(parsed) : null
  }
  return parseFrame(raw)
}

export function buildBleBoardFrame(
  protocol: NinebotProtocol,
  cmd: number,
  data: Uint8Array,
  index = 0,
  encryption2AppAddr?: number,
): Uint8Array {
  return buildProtocolFrame(protocol, BOARD.BLE, cmd, data, index, encryption2AppAddr)
}

export { BOARD, APP_ADDR, PROTOCOL_G30, PROTOCOL_ENCRYPTION2 }
export type { NinebotProtocol }
