import { ADDR, USE_MOCK } from '../ble/constants.ts'
import { isNinebotWireFrameComplete, sendAndWaitForEncryptedFrame } from '../ble/receive.ts'
import {
  APP_ADDR,
  buildBleBoardFrame,
  PROTOCOL_ENCRYPTION2,
  PROTOCOL_G30,
  type NinebotProtocol,
} from '../ble/frame-utils.ts'
import { buildFrame, parseFrame } from '../ble/framing.ts'
import { parseEncryption2Frame } from '../ble/framing-encryption2.ts'
import { CMD_E2, CMD_G30 } from '../ble/protocol-types.ts'
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

  console.log(`BLE: PRE_COMM sent (${label}, g30)`)
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
  console.log(`BLE: PRE_COMM response received (${label}, g30)`)

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
  label: string,
): Promise<PreCommResult> {
  const bootstrapKey = await deriveSessionKey(deviceName, NULL_CHALLENGE)
  const preCommFrame = buildBleBoardFrame(
    PROTOCOL_ENCRYPTION2,
    CMD_E2.PRE_COMM,
    new Uint8Array(0),
    0,
  )
  const preCommWire = await encryptBootstrapFrame(bootstrapKey, preCommFrame, ecbInput)

  console.log(`BLE: PRE_COMM sent (${label}, encryption2)`)
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
  console.log(`BLE: PRE_COMM response received (${label}, encryption2)`)

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
    console.warn('BLE: PRE_COMM g30 gen2 failed, retrying gen3', gen2Error)
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

  console.log('BLE: SET_PWD sent (g30)')
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
  console.log('BLE: SET_PWD response received (g30)')

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

  console.log('BLE: AUTH sent (g30)')
  const authResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    authWire,
    8000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: authPlain, recvCounter: finalCounter } =
    await unwrapEncryptedFrame(sessionKey, counter, authResponseWire, authParam)
  console.log('BLE: AUTH response received - handshake complete (g30)')

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
  let preComm: PreCommResult

  try {
    preComm = await exchangeEncryption2PreComm(tx, rx, deviceName, NULL_CHALLENGE, 'gen3')
  } catch (gen3Error) {
    const gen3Message =
      gen3Error instanceof Error ? gen3Error.message : String(gen3Error)
    if (gen3Message.includes('Timeout')) {
      throw gen3Error
    }
    console.warn('BLE: PRE_COMM encryption2 gen3 failed, retrying gen2', gen3Error)
    preComm = await exchangeEncryption2PreComm(tx, rx, deviceName, FW_DATA, 'gen2')
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
  )
  const { wire: setPwdWire, nextCounter: afterSetPwd } = await wrapEncryptedFrame(
    phaseKey,
    counter,
    setPwdFrame,
    authParam,
  )
  counter = afterSetPwd

  console.log('BLE: SET_PWD sent (encryption2)')
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
  console.log('BLE: SET_PWD response received (encryption2)')

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
  )
  const { wire: authWire, nextCounter: afterAuth } = await wrapEncryptedFrame(
    sessionKey,
    counter,
    authFrame,
    authParam,
  )
  counter = afterAuth

  console.log('BLE: AUTH sent (encryption2)')
  const authResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    authWire,
    8000,
    { isComplete: isNinebotWireFrameComplete },
  )
  const { plaintext: authPlain, recvCounter: finalCounter } =
    await unwrapEncryptedFrame(sessionKey, counter, authResponseWire, authParam)
  console.log('BLE: AUTH response received - handshake complete (encryption2)')

  const authParsed = parseEncryption2Frame(authPlain)
  if (authParsed === null || authParsed.cmd !== CMD_E2.AUTH) {
    throw new Error('Ungültige AUTH-Antwort (Encryption2)')
  }
  if (!isAccepted(authParsed.data)) {
    throw new Error('AUTH abgelehnt (Encryption2)')
  }

  return {
    protocol: PROTOCOL_ENCRYPTION2,
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
    console.log('BLE: mock mode — using G30 handshake')
    return performG30Handshake(tx, rx, deviceName)
  }

  console.log('BLE: trying Encryption2 handshake (Max G3)')
  try {
    return await performEncryption2Handshake(tx, rx, deviceName)
  } catch (encryption2Error) {
    console.warn('BLE: Encryption2 handshake failed, trying G30', encryption2Error)
    if (!isTimeoutError(encryption2Error)) {
      console.log('BLE: non-timeout Encryption2 error — still trying G30 fallback')
    }
  }

  console.log('BLE: trying G30 handshake')
  return performG30Handshake(tx, rx, deviceName)
}
