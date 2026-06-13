import { ADDR, USE_MOCK } from '../ble/constants.ts'
import { bleDebugError, bleDebugLog, bleDebugSuccess, bleDebugWarn } from '../ble/debug-log.ts'
import { isNinebotWireFrameComplete, sendAndWaitForEncryptedFrame } from '../ble/receive.ts'
import {
  APP_ADDR,
  buildBleBoardFrame,
  PROTOCOL_ENCRYPTION2,
  PROTOCOL_G30,
  type NinebotProtocol,
} from '../ble/frame-utils.ts'
import { buildFrame, parseFrame } from '../ble/framing.ts'
import { buildEncryption2Frame, parseEncryption2Frame } from '../ble/framing-encryption2.ts'
import {
  APP_ADDR_E2_FALLBACK,
  BOARD,
  CMD_E2,
  CMD_G30,
} from '../ble/protocol-types.ts'
import {
  decryptBootstrapFrame,
  deriveAuthToken,
  deriveKeyMaterial,
  deriveSessionKey,
  encryptBootstrapFrame,
  generateSessionPassword,
  unwrapEncryptedFrame,
  wrapEncryptedFrame,
} from './aes.ts'
import { FW_DATA, HANDSHAKE_ACCEPTED, NULL_CHALLENGE } from './constants.ts'

export interface SessionState {
  protocol: NinebotProtocol
  /** App-Adresse für Encryption2 (0x21 Max G3, ggf. 0x04 Fallback) */
  encryption2AppAddr?: number
  key: CryptoKey
  counter: number
  serial: string
  authParam: Uint8Array
  tx: BluetoothRemoteGATTCharacteristic
  rx: BluetoothRemoteGATTCharacteristic
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function isAccepted(data: Uint8Array): boolean {
  return data.length === 1 && data[0] === HANDSHAKE_ACCEPTED
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Timeout')
}

function encodeSerialField(serial: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  bytes.set(new TextEncoder().encode(serial).slice(0, length))
  return bytes
}

interface PreCommResult {
  authParam: Uint8Array
  serial: string
}

async function exchangeG30PreComm(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  deviceName: string,
  ecbInput: Uint8Array,
  label: string,
): Promise<PreCommResult> {
  const bootstrapKey = await deriveSessionKey(deviceName, NULL_CHALLENGE)
  const challenge = randomBytes(16)
  const preCommFrame = buildFrame(ADDR.BLE, APP_ADDR[PROTOCOL_G30], CMD_G30.PRE_COMM, challenge)
  const preCommWire = await encryptBootstrapFrame(bootstrapKey, preCommFrame, ecbInput)

  bleDebugLog(`PRE_COMM gesendet (${label}, G30)`)
  const preCommResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    preCommWire,
    8000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const preCommPlain = await decryptBootstrapFrame(
    bootstrapKey,
    preCommResponseWire,
    ecbInput,
  )
  bleDebugSuccess(`PRE_COMM Antwort (${label}, G30) — SN wird geparst`)

  const preCommParsed = parseFrame(preCommPlain)
  if (
    preCommParsed === null ||
    preCommParsed.cmd !== CMD_G30.PRE_COMM ||
    preCommParsed.data.length < 30
  ) {
    throw new Error('Ungültige PRE_COMM-Antwort (G30)')
  }

  return {
    authParam: preCommParsed.data.slice(0, 16),
    serial: new TextDecoder()
      .decode(preCommParsed.data.slice(16, 30))
      .replace(/\0/g, ''),
  }
}

async function exchangeEncryption2PreComm(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  deviceName: string,
  ecbInput: Uint8Array,
  appAddr: number,
  label: string,
): Promise<PreCommResult> {
  const bootstrapKey = await deriveSessionKey(deviceName, FW_DATA)
  const preCommFrame = buildEncryption2Frame(
    BOARD.BLE,
    appAddr,
    CMD_E2.PRE_COMM,
    new Uint8Array(0),
    0,
  )
  const preCommWire = await encryptBootstrapFrame(bootstrapKey, preCommFrame, ecbInput)

  bleDebugLog(
    `PRE_COMM gesendet (${label}, Encryption2, App=0x${appAddr.toString(16).padStart(2, '0')})`,
  )
  const preCommResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    preCommWire,
    8000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const preCommPlain = await decryptBootstrapFrame(
    bootstrapKey,
    preCommResponseWire,
    ecbInput,
  )
  bleDebugSuccess(`PRE_COMM Antwort (${label}, Encryption2) — SN wird geparst`)

  const preCommParsed = parseEncryption2Frame(preCommPlain)
  if (
    preCommParsed === null ||
    preCommParsed.cmd !== CMD_E2.PRE_COMM ||
    preCommParsed.data.length < 30
  ) {
    throw new Error('Ungültige PRE_COMM-Antwort (Encryption2)')
  }

  return {
    authParam: preCommParsed.data.slice(0, 16),
    serial: new TextDecoder()
      .decode(preCommParsed.data.slice(16, 30))
      .replace(/\0/g, ''),
  }
}

async function performG30Handshake(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  deviceName: string,
): Promise<SessionState> {
  let counter = 0
  let preComm: PreCommResult

  try {
    preComm = await exchangeG30PreComm(tx, rx, deviceName, FW_DATA, 'gen2')
  } catch (gen2Error) {
    const gen2Message =
      gen2Error instanceof Error ? gen2Error.message : String(gen2Error)
    if (gen2Message.includes('Timeout')) {
      throw gen2Error
    }
    bleDebugWarn(`PRE_COMM G30 gen2 fehlgeschlagen — Retry gen3`)
    bleDebugError('PRE_COMM G30 gen2', gen2Error)
    preComm = await exchangeG30PreComm(tx, rx, deviceName, NULL_CHALLENGE, 'gen3')
  }

  const { authParam, serial } = preComm

  counter = 1
  const phaseKey = await deriveSessionKey(deviceName, authParam)
  const sessionPassword = await generateSessionPassword(authParam)
  const setPwdFrame = buildFrame(ADDR.BLE, APP_ADDR[PROTOCOL_G30], CMD_G30.SET_PWD, sessionPassword)
  const { wire: setPwdWire, nextCounter: afterSetPwd } = await wrapEncryptedFrame(
    phaseKey,
    counter,
    setPwdFrame,
    authParam,
  )
  counter = afterSetPwd

  bleDebugLog('SET_PWD gesendet (G30)')
  const setPwdResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    setPwdWire,
    10000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: setPwdPlain, recvCounter: afterSetPwdRx } =
    await unwrapEncryptedFrame(phaseKey, counter, setPwdResponseWire, authParam)
  counter = afterSetPwdRx
  bleDebugSuccess('SET_PWD Antwort (G30)')

  const setPwdParsed = parseFrame(setPwdPlain)
  if (setPwdParsed === null || setPwdParsed.cmd !== CMD_G30.SET_PWD) {
    throw new Error('Ungültige SET_PWD-Antwort (G30)')
  }
  if (!isAccepted(setPwdParsed.data)) {
    throw new Error('SET_PWD abgelehnt (G30)')
  }

  const sessionKey = await deriveKeyMaterial(sessionPassword, authParam)
  const authToken = await deriveAuthToken(sessionPassword, authParam)
  const authFrame = buildFrame(ADDR.BLE, APP_ADDR[PROTOCOL_G30], CMD_G30.AUTH, authToken)
  const { wire: authWire, nextCounter: afterAuth } = await wrapEncryptedFrame(
    sessionKey,
    counter,
    authFrame,
    authParam,
  )
  counter = afterAuth

  bleDebugLog('AUTH gesendet (G30)')
  const authResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    authWire,
    8000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: authPlain, recvCounter: finalCounter } =
    await unwrapEncryptedFrame(sessionKey, counter, authResponseWire, authParam)
  bleDebugSuccess('AUTH Antwort — Handshake complete (G30)')

  const authParsed = parseFrame(authPlain)
  if (authParsed === null || authParsed.cmd !== CMD_G30.AUTH) {
    throw new Error('Ungültige AUTH-Antwort (G30)')
  }
  if (!isAccepted(authParsed.data)) {
    throw new Error('AUTH abgelehnt (G30)')
  }

  return {
    protocol: PROTOCOL_G30,
    key: sessionKey,
    counter: finalCounter,
    serial,
    authParam,
    tx,
    rx,
  }
}

async function performEncryption2Handshake(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  deviceName: string,
): Promise<SessionState> {
  let counter = 0
  let preComm: PreCommResult | undefined
  let appAddr: number = APP_ADDR[PROTOCOL_ENCRYPTION2]

  const preCommAttempts: Array<{ app: number; ecb: Uint8Array; label: string }> = [
    { app: APP_ADDR[PROTOCOL_ENCRYPTION2], ecb: FW_DATA, label: 'app=0x21 fw' },
    { app: APP_ADDR_E2_FALLBACK, ecb: FW_DATA, label: 'app=0x04 fw' },
    { app: APP_ADDR[PROTOCOL_ENCRYPTION2], ecb: NULL_CHALLENGE, label: 'app=0x21 zero' },
    { app: APP_ADDR_E2_FALLBACK, ecb: NULL_CHALLENGE, label: 'app=0x04 zero' },
  ]

  let lastError: unknown = new Error('PRE_COMM Encryption2 — keine Versuche')
  for (const attempt of preCommAttempts) {
    try {
      preComm = await exchangeEncryption2PreComm(
        tx,
        rx,
        deviceName,
        attempt.ecb,
        attempt.app,
        attempt.label,
      )
      appAddr = attempt.app
      break
    } catch (error) {
      lastError = error
      bleDebugWarn(`PRE_COMM ${attempt.label} fehlgeschlagen`)
      bleDebugError(`PRE_COMM ${attempt.label}`, error)
    }
  }

  if (!preComm) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  const { authParam, serial } = preComm

  counter = 1
  const phaseKey = await deriveSessionKey(deviceName, authParam)
  const sessionPassword = await generateSessionPassword(authParam)
  const setPwdFrame = buildBleBoardFrame(
    PROTOCOL_ENCRYPTION2,
    CMD_E2.SET_PWD,
    sessionPassword,
    0,
    appAddr,
  )
  const { wire: setPwdWire, nextCounter: afterSetPwd } = await wrapEncryptedFrame(
    phaseKey,
    counter,
    setPwdFrame,
    authParam,
  )
  counter = afterSetPwd

  bleDebugLog('SET_PWD gesendet (Encryption2)')
  const setPwdResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    setPwdWire,
    10000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: setPwdPlain, recvCounter: afterSetPwdRx } =
    await unwrapEncryptedFrame(phaseKey, counter, setPwdResponseWire, authParam)
  counter = afterSetPwdRx
  bleDebugSuccess('SET_PWD Antwort (Encryption2)')

  const setPwdParsed = parseEncryption2Frame(setPwdPlain)
  if (setPwdParsed === null || setPwdParsed.cmd !== CMD_E2.SET_PWD) {
    throw new Error('Ungültige SET_PWD-Antwort (Encryption2)')
  }
  if (!isAccepted(setPwdParsed.data)) {
    throw new Error('SET_PWD abgelehnt (Encryption2)')
  }

  const sessionKey = await deriveKeyMaterial(sessionPassword, authParam)
  const authFrame = buildBleBoardFrame(
    PROTOCOL_ENCRYPTION2,
    CMD_E2.AUTH,
    encodeSerialField(serial, 14),
    0,
    appAddr,
  )
  const { wire: authWire, nextCounter: afterAuth } = await wrapEncryptedFrame(
    sessionKey,
    counter,
    authFrame,
    authParam,
  )
  counter = afterAuth

  bleDebugLog('AUTH gesendet (Encryption2)')
  const authResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    authWire,
    8000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: authPlain, recvCounter: finalCounter } =
    await unwrapEncryptedFrame(sessionKey, counter, authResponseWire, authParam)
  bleDebugSuccess('AUTH Antwort — Handshake complete (Encryption2)')

  const authParsed = parseEncryption2Frame(authPlain)
  if (authParsed === null || authParsed.cmd !== CMD_E2.AUTH) {
    throw new Error('Ungültige AUTH-Antwort (Encryption2)')
  }
  if (!isAccepted(authParsed.data)) {
    throw new Error('AUTH abgelehnt (Encryption2)')
  }

  return {
    protocol: PROTOCOL_ENCRYPTION2,
    encryption2AppAddr: appAddr,
    key: sessionKey,
    counter: finalCounter,
    serial,
    authParam,
    tx,
    rx,
  }
}

/**
 * Führt den Ninebot-Handshake aus und erkennt automatisch G30 vs. Encryption2 (Max G3).
 */
export async function performHandshake(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  deviceName: string,
): Promise<SessionState> {
  if (USE_MOCK) {
    bleDebugLog('Mock-Modus — G30 Handshake')
    return performG30Handshake(tx, rx, deviceName)
  }

  bleDebugLog('Versuche Encryption2 Handshake (Max G3)…')
  try {
    return await performEncryption2Handshake(tx, rx, deviceName)
  } catch (encryption2Error) {
    bleDebugError('Encryption2 Handshake', encryption2Error)
    if (!isTimeoutError(encryption2Error)) {
      bleDebugWarn('Encryption2 fehlgeschlagen — Fallback auf G30')
    } else {
      bleDebugWarn('Encryption2 Timeout — Fallback auf G30')
    }
  }

  bleDebugLog('Versuche G30 Handshake…')
  return performG30Handshake(tx, rx, deviceName)
}
