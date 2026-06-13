import { ADDR } from '../ble/constants.ts'
import { buildProtocolFrame, parseProtocolFrame } from '../ble/frame-utils.ts'
import { sendAndWaitForEncryptedFrame, isNinebotWireFrameComplete } from '../ble/receive.ts'
import { unwrapEncryptedFrame, wrapEncryptedFrame } from '../crypto/aes.ts'
import type { SessionState } from '../crypto/handshake.ts'

export const CMD_READ = 0x01
export const CMD_WRITE = 0x02
export const CMD_READ_RESP = 0x04
export const CMD_WRITE_RESP = 0x05

/** Wichtige Register-Adressen (ESC Board 0x3D). */
export const REGISTERS = {
  SPEED_LIMIT: 0x01f,
  SPEED_CURRENT: 0x023,
  BATTERY_PERCENT: 0x022,
  FIRMWARE_VERSION: 0x01a,
  SERIAL_NUMBER: 0x010,
  LIGHT_STATE: 0x07c,
  LOCK_STATE: 0x07d,
  KERS_MODE: 0x089,
  SPORT_MODE: 0x08c,
} as const

export const BLE_FIRMWARE_VERSION = 0x68
export const BMS_FIRMWARE_VERSION = 0x30

export interface DeviceInfo {
  serial: string
  firmwareDrv: string
  firmwareBle: string
  firmwareBms: string
}

export async function exchangeFrame(
  session: SessionState,
  plaintext: Uint8Array,
  timeoutMs = 5000,
): Promise<{ dest: number; src: number; cmd: number; data: Uint8Array }> {
  const { wire, nextCounter } = await wrapEncryptedFrame(
    session.key,
    session.counter,
    plaintext,
    session.authParam,
  )

  const responseWire = await sendAndWaitForEncryptedFrame(
    session.tx,
    session.rx,
    wire,
    timeoutMs,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: responsePlain, recvCounter } = await unwrapEncryptedFrame(
    session.key,
    nextCounter,
    responseWire,
    session.authParam,
  )

  session.counter = recvCounter

  const parsed = parseProtocolFrame(session.protocol, responsePlain)
  if (parsed === null) {
    throw new Error('Ungültige Antwort')
  }

  return parsed
}

function buildReadPayload(register: number, length: number): Uint8Array {
  return new Uint8Array([register & 0xff, length & 0xff])
}

function buildWritePayload(register: number, data: Uint8Array): Uint8Array {
  const payload = new Uint8Array(1 + data.length)
  payload[0] = register & 0xff
  payload.set(data, 1)
  return payload
}

export function decodeVersion(data: Uint8Array): string {
  if (data.length < 2) {
    return '0.0.0.0'
  }
  const major = (data[1]! >> 4) & 0x0f
  const minor = data[1]! & 0x0f
  const patch = (data[0]! >> 4) & 0x0f
  const build = data[0]! & 0x0f
  return `${major}.${minor}.${patch}.${build}`
}

function decodeSerial(data: Uint8Array): string {
  return new TextDecoder().decode(data).replace(/\0/g, '')
}

function kmhToSpeedLimitRaw(kmh: number): number {
  return Math.round((kmh * 1000) / 3.6)
}

function encodeUint32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, value >>> 0, true)
  return bytes
}

/**
 * Liest ein Register vom angegebenen Board.
 */
export async function readRegister(
  session: SessionState,
  board: number,
  register: number,
  length: number,
): Promise<Uint8Array> {
  const frame = buildProtocolFrame(
    session.protocol,
    board,
    CMD_READ,
    buildReadPayload(register, length),
  )
  const response = await exchangeFrame(session, frame)

  if (response.cmd !== CMD_READ_RESP) {
    throw new Error(`Unerwartete READ-Antwort: 0x${response.cmd.toString(16)}`)
  }

  return response.data.length > 1 ? response.data.slice(1) : response.data
}

/**
 * Schreibt Daten in ein Register des angegebenen Boards.
 */
export async function writeRegister(
  session: SessionState,
  board: number,
  register: number,
  data: Uint8Array,
): Promise<boolean> {
  const frame = buildProtocolFrame(
    session.protocol,
    board,
    CMD_WRITE,
    buildWritePayload(register, data),
  )
  const response = await exchangeFrame(session, frame)

  if (response.cmd !== CMD_WRITE_RESP) {
    return false
  }

  return response.data.length === 0 || response.data[0] === 0x01
}

/**
 * Liest Seriennummer und Firmware-Versionen von DRV, BLE und BMS.
 */
export async function getDeviceInfo(session: SessionState): Promise<DeviceInfo> {
  const [serialData, drvData, bleData, bmsData] = await Promise.all([
    readRegister(session, ADDR.ESC, REGISTERS.SERIAL_NUMBER, 8).catch(
      () => new TextEncoder().encode(session.serial),
    ),
    readRegister(session, ADDR.ESC, REGISTERS.FIRMWARE_VERSION, 2),
    readRegister(session, ADDR.BLE, BLE_FIRMWARE_VERSION, 2),
    readRegister(session, ADDR.BMS, BMS_FIRMWARE_VERSION, 2),
  ])

  return {
    serial: serialData.length > 0 ? decodeSerial(serialData) : session.serial,
    firmwareDrv: decodeVersion(drvData),
    firmwareBle: decodeVersion(bleData),
    firmwareBms: decodeVersion(bmsData),
  }
}

/**
 * Setzt das Geschwindigkeitslimit in km/h (intern 0.001 m/s-Einheiten).
 */
export async function setSpeedLimit(
  session: SessionState,
  kmh: number,
): Promise<boolean> {
  const raw = kmhToSpeedLimitRaw(kmh)
  return writeRegister(
    session,
    ADDR.ESC,
    REGISTERS.SPEED_LIMIT,
    encodeUint32LE(raw),
  )
}
