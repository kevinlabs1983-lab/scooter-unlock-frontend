import {
  ADDR,
  NINEBOT_RX_CHAR_UUID,
  NINEBOT_SERVICE_UUID,
  NINEBOT_TX_CHAR_UUID,
} from './constants.ts'
import { buildFrame, parseFrame } from './framing.ts'
import { performHandshake } from '../crypto/handshake.ts'
import type { ConnectedScooter } from './transport.ts'
import {
  decryptBootstrapFrame,
  deriveKeyMaterial,
  deriveSessionKey,
  encryptBootstrapFrame,
  unwrapEncryptedFrame,
  wrapEncryptedFrame,
} from '../crypto/aes.ts'
import {
  CMD_AUTH,
  CMD_PRE_COMM,
  CMD_SET_PWD,
  FW_DATA,
  HANDSHAKE_ACCEPTED,
} from '../crypto/constants.ts'
import {
  BLE_FIRMWARE_VERSION,
  BMS_FIRMWARE_VERSION,
  CMD_READ,
  CMD_READ_RESP,
  CMD_WRITE,
  CMD_WRITE_RESP,
  REGISTERS,
} from '../protocol/commands.ts'
import {
  CMD_IAP_ACK,
  CMD_IAP_BEGIN,
  CMD_IAP_RESET,
  CMD_IAP_TRANS,
  CMD_IAP_VERIFY,
  IAP_ACK_OK,
} from '../protocol/firmware.ts'

/** Fester auth_param für reproduzierbare Mock-Sessions. */
export const MOCK_AUTH_PARAM = new Uint8Array([
  0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44, 0x55,
  0x66, 0x77, 0x88,
])

export const MOCK_DEVICE_NAME = 'NBx-MOCK'
export const MOCK_SERIAL = 'NBxxx/12345678'
const FLASH_CHUNK_DELAY_MS = 10

type MockPhase = 'pre_comm' | 'set_pwd' | 'auth' | 'session'

function encodeVersion(
  major: number,
  minor: number,
  patch: number,
  build = 0,
): Uint8Array {
  return new Uint8Array([
    ((patch & 0x0f) << 4) | (build & 0x0f),
    ((major & 0x0f) << 4) | (minor & 0x0f),
  ])
}

function encodeUint32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

function encodeSerial(serial: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  bytes.set(new TextEncoder().encode(serial).slice(0, length))
  return bytes
}

function kmhToSpeedLimitRaw(kmh: number): number {
  return Math.round((kmh * 1000) / 3.6)
}

const MOCK_VERSIONS = {
  drv: encodeVersion(1, 7, 3),
  ble: encodeVersion(1, 1, 4),
  bms: encodeVersion(1, 3, 4),
} as const

class MockEventTarget {
  private listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener)
  }

  protected dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
}

class MockGATTCharacteristic extends MockEventTarget {
  value: DataView | null = null
  uuid: string
  private notificationsEnabled = false
  private readonly onWrite: (data: Uint8Array) => Promise<void>

  constructor(uuid: string, onWrite: (data: Uint8Array) => Promise<void>) {
    super()
    this.uuid = uuid
    this.onWrite = onWrite
  }

  async startNotifications(): Promise<MockGATTCharacteristic> {
    this.notificationsEnabled = true
    return this
  }

  async writeValueWithoutResponse(value: BufferSource): Promise<void> {
    const buffer =
      value instanceof ArrayBuffer
        ? value
        : value instanceof DataView
          ? value.buffer
          : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)

    await this.onWrite(new Uint8Array(buffer))
  }

  notify(data: Uint8Array): void {
    if (!this.notificationsEnabled) {
      return
    }

    const copy = new Uint8Array(data)
    this.value = new DataView(copy.buffer)
    this.dispatch('characteristicvaluechanged', { target: this } as unknown as Event)
  }
}

class MockScooterProtocol {
  private phase: MockPhase = 'pre_comm'
  private phaseKey: CryptoKey | null = null
  private sessionKey: CryptoKey | null = null
  private lastCounter = 0
  private readonly deviceName: string
  private readonly rxChar: MockGATTCharacteristic

  constructor(deviceName: string, rxChar: MockGATTCharacteristic) {
    this.deviceName = deviceName
    this.rxChar = rxChar
  }

  async handleTx(data: Uint8Array): Promise<void> {
    if (this.phase === 'pre_comm') {
      await this.handlePreComm(data)
      return
    }

    if (this.phase === 'set_pwd') {
      await this.handleSetPwd(data)
      return
    }

    if (this.phase === 'auth') {
      await this.handleAuth(data)
      return
    }

    await this.handleSessionCommand(data)
  }

  private async notifyEncrypted(
    key: CryptoKey,
    counter: number,
    plaintext: Uint8Array,
  ): Promise<void> {
    const { wire } = await wrapEncryptedFrame(key, counter, plaintext, MOCK_AUTH_PARAM)
    window.setTimeout(() => this.rxChar.notify(wire), 0)
  }

  private async handlePreComm(wire: Uint8Array): Promise<void> {
    const bootstrapKey = await deriveSessionKey(this.deviceName, FW_DATA)
    const plaintext = await decryptBootstrapFrame(bootstrapKey, wire, FW_DATA)
    const parsed = parseFrame(plaintext)

    if (parsed?.cmd !== CMD_PRE_COMM) {
      throw new Error('Mock: unerwartetes PRE_COMM-Kommando')
    }

    this.phaseKey = await deriveSessionKey(this.deviceName, MOCK_AUTH_PARAM)
    this.phase = 'set_pwd'

    const serialBytes = encodeSerial(MOCK_SERIAL, 14)
    const responseData = new Uint8Array(MOCK_AUTH_PARAM.length + serialBytes.length)
    responseData.set(MOCK_AUTH_PARAM, 0)
    responseData.set(serialBytes, MOCK_AUTH_PARAM.length)

    const responseFrame = buildFrame(
      ADDR.APP,
      ADDR.BLE,
      CMD_PRE_COMM,
      responseData,
    )
    const responseWire = await encryptBootstrapFrame(
      bootstrapKey,
      responseFrame,
      FW_DATA,
    )
    window.setTimeout(() => this.rxChar.notify(responseWire), 0)
  }

  private async handleSetPwd(wire: Uint8Array): Promise<void> {
    if (!this.phaseKey) {
      throw new Error('Mock: Phase-Key fehlt')
    }

    const { plaintext, recvCounter } = await unwrapEncryptedFrame(
      this.phaseKey,
      this.lastCounter,
      wire,
      MOCK_AUTH_PARAM,
    )
    this.lastCounter = recvCounter

    const parsed = parseFrame(plaintext)
    if (parsed?.cmd !== CMD_SET_PWD || parsed.data.length < 16) {
      throw new Error('Mock: ungültiges SET_PWD')
    }

    this.sessionKey = await deriveKeyMaterial(parsed.data, MOCK_AUTH_PARAM)
    this.phase = 'auth'

    const responseFrame = buildFrame(
      ADDR.APP,
      ADDR.BLE,
      CMD_SET_PWD,
      new Uint8Array([HANDSHAKE_ACCEPTED]),
    )
    await this.notifyEncrypted(this.phaseKey, recvCounter, responseFrame)
  }

  private async handleAuth(wire: Uint8Array): Promise<void> {
    if (!this.sessionKey) {
      throw new Error('Mock: Session-Key fehlt')
    }

    const { plaintext, recvCounter } = await unwrapEncryptedFrame(
      this.sessionKey,
      this.lastCounter,
      wire,
      MOCK_AUTH_PARAM,
    )
    this.lastCounter = recvCounter

    const parsed = parseFrame(plaintext)
    if (parsed?.cmd !== CMD_AUTH) {
      throw new Error('Mock: ungültiges AUTH')
    }

    this.phase = 'session'

    const responseFrame = buildFrame(
      ADDR.APP,
      ADDR.BLE,
      CMD_AUTH,
      new Uint8Array([HANDSHAKE_ACCEPTED]),
    )
    await this.notifyEncrypted(this.sessionKey, recvCounter, responseFrame)
  }

  private async handleSessionCommand(wire: Uint8Array): Promise<void> {
    if (!this.sessionKey) {
      throw new Error('Mock: Session nicht aktiv')
    }

    const { plaintext, recvCounter } = await unwrapEncryptedFrame(
      this.sessionKey,
      this.lastCounter,
      wire,
      MOCK_AUTH_PARAM,
    )
    this.lastCounter = recvCounter

    const parsed = parseFrame(plaintext)
    if (!parsed) {
      throw new Error('Mock: ungültiger Session-Frame')
    }

    const responseFrame = await this.buildSessionResponse(parsed)
    await this.notifyEncrypted(this.sessionKey, recvCounter, responseFrame)
  }

  private async buildSessionResponse(
    parsed: { dest: number; src: number; cmd: number; data: Uint8Array },
  ): Promise<Uint8Array> {
    const board = parsed.dest

    if (parsed.cmd === CMD_READ) {
      const register = parsed.data[0] ?? 0
      const length = parsed.data[1] ?? 1
      const value = this.readRegister(board, register, length)
      const payload = new Uint8Array(1 + value.length)
      payload[0] = register
      payload.set(value, 1)
      return buildFrame(board, ADDR.APP, CMD_READ_RESP, payload)
    }

    if (parsed.cmd === CMD_WRITE) {
      return buildFrame(
        board,
        ADDR.APP,
        CMD_WRITE_RESP,
        new Uint8Array([HANDSHAKE_ACCEPTED]),
      )
    }

    if (
      parsed.cmd === CMD_IAP_BEGIN ||
      parsed.cmd === CMD_IAP_VERIFY ||
      parsed.cmd === CMD_IAP_RESET
    ) {
      return buildFrame(board, ADDR.APP, CMD_IAP_ACK, new Uint8Array([IAP_ACK_OK]))
    }

    if (parsed.cmd === CMD_IAP_TRANS) {
      await new Promise((resolve) => window.setTimeout(resolve, FLASH_CHUNK_DELAY_MS))
      return buildFrame(board, ADDR.APP, CMD_IAP_ACK, new Uint8Array([IAP_ACK_OK]))
    }

    return buildFrame(board, ADDR.APP, parsed.cmd, new Uint8Array([HANDSHAKE_ACCEPTED]))
  }

  private readRegister(board: number, register: number, length: number): Uint8Array {
    const value = this.getRegisterValue(board, register)
    if (value.length >= length) {
      return value.slice(0, length)
    }

    const padded = new Uint8Array(length)
    padded.set(value)
    return padded
  }

  private getRegisterValue(board: number, register: number): Uint8Array {
    if (board === ADDR.ESC) {
      switch (register) {
        case REGISTERS.SERIAL_NUMBER & 0xff:
          return encodeSerial(MOCK_SERIAL, 14)
        case REGISTERS.FIRMWARE_VERSION & 0xff:
          return MOCK_VERSIONS.drv
        case REGISTERS.BATTERY_PERCENT & 0xff:
          return new Uint8Array([75])
        case REGISTERS.SPEED_LIMIT & 0xff:
          return encodeUint32LE(kmhToSpeedLimitRaw(25))
        default:
          break
      }
    }

    if (board === ADDR.BLE && register === BLE_FIRMWARE_VERSION) {
      return MOCK_VERSIONS.ble
    }

    if (board === ADDR.BMS && register === BMS_FIRMWARE_VERSION) {
      return MOCK_VERSIONS.bms
    }

    return new Uint8Array([0])
  }
}

class MockGATTServer {
  private isConnected = false
  private readonly txChar: MockGATTCharacteristic
  private readonly rxChar: MockGATTCharacteristic

  constructor(deviceName: string) {
    let protocol: MockScooterProtocol

    this.rxChar = new MockGATTCharacteristic(NINEBOT_RX_CHAR_UUID, async () => {
      // RX empfängt nichts — Antworten werden per Notify gesendet
    })

    this.txChar = new MockGATTCharacteristic(NINEBOT_TX_CHAR_UUID, async (data) => {
      await protocol.handleTx(data)
    })

    protocol = new MockScooterProtocol(deviceName, this.rxChar)
  }

  async connect(): Promise<MockGATTServer> {
    this.isConnected = true
    return this
  }

  disconnect(): void {
    this.isConnected = false
  }

  get connected(): boolean {
    return this.isConnected
  }

  async getPrimaryService(uuid: string): Promise<MockGATTService> {
    if (!this.isConnected) {
      throw new Error('GATT nicht verbunden')
    }
    if (uuid !== NINEBOT_SERVICE_UUID) {
      throw new Error(`Unbekannter Service: ${uuid}`)
    }
    return new MockGATTService(this.txChar, this.rxChar)
  }
}

class MockGATTService {
  private readonly txChar: MockGATTCharacteristic
  private readonly rxChar: MockGATTCharacteristic

  constructor(txChar: MockGATTCharacteristic, rxChar: MockGATTCharacteristic) {
    this.txChar = txChar
    this.rxChar = rxChar
  }

  async getCharacteristic(uuid: string): Promise<MockGATTCharacteristic> {
    if (uuid === NINEBOT_TX_CHAR_UUID) {
      return this.txChar
    }
    if (uuid === NINEBOT_RX_CHAR_UUID) {
      return this.rxChar
    }
    throw new Error(`Unbekannte Characteristic: ${uuid}`)
  }
}

export class MockBluetoothDevice {
  readonly id = 'mock-ninebot-scooter'
  readonly name = MOCK_DEVICE_NAME
  readonly gatt: MockGATTServer

  constructor() {
    this.gatt = new MockGATTServer(MOCK_DEVICE_NAME)
  }
}

export async function connectToMockScooter(): Promise<ConnectedScooter> {
  await new Promise((resolve) => window.setTimeout(resolve, 250))

  const device = new MockBluetoothDevice()
  const gatt = await device.gatt.connect()
  const service = await gatt.getPrimaryService(NINEBOT_SERVICE_UUID)
  const txChar = await service.getCharacteristic(NINEBOT_TX_CHAR_UUID)
  const rxChar = await service.getCharacteristic(NINEBOT_RX_CHAR_UUID)

  await rxChar.startNotifications()

  const tx = txChar as unknown as BluetoothRemoteGATTCharacteristic
  const rx = rxChar as unknown as BluetoothRemoteGATTCharacteristic
  const session = await performHandshake(tx, rx, MOCK_DEVICE_NAME)

  return {
    connection: {
      device: device as unknown as BluetoothDevice,
      txChar: tx,
      rxChar: rx,
    },
    session,
  }
}
