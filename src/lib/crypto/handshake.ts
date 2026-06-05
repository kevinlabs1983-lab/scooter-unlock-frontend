import { ADDR } from '../ble/constants.ts'
import { sendAndWaitForEncryptedFrame } from '../ble/receive.ts'
import { buildFrame, parseFrame } from '../ble/framing.ts'
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
import {
  CMD_AUTH,
  CMD_PRE_COMM,
  CMD_SET_PWD,
  FW_DATA,
  HANDSHAKE_ACCEPTED,
} from './constants.ts'

export interface SessionState {
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

/**
 * Führt den 3-Phasen Ninebot Encryption2-Handshake aus.
 *
 * Phase 1 PRE_COMM (0x65): Zufalls-Challenge → auth_param + Serial
 * Phase 2 SET_PWD   (0x64): Session-Passwort → 0x01 accepted
 * Phase 3 AUTH      (0x67): abgeleitetes Token → 0x01 session aktiv
 */
export async function performHandshake(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  deviceName: string,
): Promise<SessionState> {
  let counter = 0

  const bootstrapKey = await deriveSessionKey(deviceName, FW_DATA)
  const challenge = randomBytes(16)
  const preCommFrame = buildFrame(ADDR.BLE, ADDR.APP, CMD_PRE_COMM, challenge)
  const preCommWire = await encryptBootstrapFrame(
    bootstrapKey,
    preCommFrame,
    FW_DATA,
  )

  console.log('BLE: PRE_COMM sent')
  const preCommResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    preCommWire,
    5000,
    { minLength: 41, debounceMs: 40 },
  )
  const preCommPlain = await decryptBootstrapFrame(
    bootstrapKey,
    preCommResponseWire,
    FW_DATA,
  )
  console.log('BLE: PRE_COMM response received')

  const preCommParsed = parseFrame(preCommPlain)
  if (
    preCommParsed === null ||
    preCommParsed.cmd !== CMD_PRE_COMM ||
    preCommParsed.data.length < 30
  ) {
    throw new Error('Ungültige PRE_COMM-Antwort')
  }

  const authParam = preCommParsed.data.slice(0, 16)
  const serialBytes = preCommParsed.data.slice(16, 30)
  const serial = new TextDecoder().decode(serialBytes).replace(/\0/g, '')

  counter = 1
  const phaseKey = await deriveSessionKey(deviceName, authParam)

  const sessionPassword = await generateSessionPassword(authParam)
  const setPwdFrame = buildFrame(
    ADDR.BLE,
    ADDR.APP,
    CMD_SET_PWD,
    sessionPassword,
  )
  const { wire: setPwdWire, nextCounter: afterSetPwd } = await wrapEncryptedFrame(
    phaseKey,
    counter,
    setPwdFrame,
    authParam,
  )
  counter = afterSetPwd

  console.log('BLE: SET_PWD sent')
  const setPwdResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    setPwdWire,
    10000,
    { minLength: 12, debounceMs: 40 },
  )
  const { plaintext: setPwdPlain, recvCounter: afterSetPwdRx } =
    await unwrapEncryptedFrame(phaseKey, counter, setPwdResponseWire, authParam)
  counter = afterSetPwdRx
  console.log('BLE: SET_PWD response received')

  const setPwdParsed = parseFrame(setPwdPlain)
  if (setPwdParsed === null || setPwdParsed.cmd !== CMD_SET_PWD) {
    throw new Error('Ungültige SET_PWD-Antwort')
  }
  if (!isAccepted(setPwdParsed.data)) {
    throw new Error('SET_PWD abgelehnt')
  }

  const sessionKey = await deriveKeyMaterial(sessionPassword, authParam)
  const authToken = await deriveAuthToken(sessionPassword, authParam)
  const authFrame = buildFrame(ADDR.BLE, ADDR.APP, CMD_AUTH, authToken)
  const { wire: authWire, nextCounter: afterAuth } = await wrapEncryptedFrame(
    sessionKey,
    counter,
    authFrame,
    authParam,
  )
  counter = afterAuth

  console.log('BLE: AUTH sent')
  const authResponseWire = await sendAndWaitForEncryptedFrame(
    tx,
    rx,
    authWire,
    5000,
    { minLength: 12, debounceMs: 40 },
  )
  const { plaintext: authPlain, recvCounter: finalCounter } =
    await unwrapEncryptedFrame(sessionKey, counter, authResponseWire, authParam)
  console.log('BLE: AUTH response received - handshake complete')

  const authParsed = parseFrame(authPlain)
  if (authParsed === null || authParsed.cmd !== CMD_AUTH) {
    throw new Error('Ungültige AUTH-Antwort')
  }
  if (!isAccepted(authParsed.data)) {
    throw new Error('AUTH abgelehnt')
  }

  return {
    key: sessionKey,
    counter: finalCounter,
    serial,
    authParam,
    tx,
    rx,
  }
}
