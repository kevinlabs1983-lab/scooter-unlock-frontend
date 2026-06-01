import { ADDR } from '../ble/constants.ts'
import { buildFrame, parseFrame } from '../ble/framing.ts'
import { sendFrame } from '../ble/transport.ts'
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

function waitForEncryptedFrame(
  rx: BluetoothRemoteGATTCharacteristic,
  timeoutMs: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      window.clearTimeout(timer)
      rx.removeEventListener('characteristicvaluechanged', onChange)
    }

    const timer = window.setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(new Error('Handshake-Timeout'))
    }, timeoutMs)

    const onChange = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      if (!target.value || settled) {
        return
      }

      settled = true
      const { buffer, byteOffset, byteLength } = target.value
      cleanup()
      resolve(new Uint8Array(buffer, byteOffset, byteLength))
    }

    rx.addEventListener('characteristicvaluechanged', onChange)
  })
}

function isAccepted(data: Uint8Array): boolean {
  return data.length === 1 && data[0] === HANDSHAKE_ACCEPTED
}

async function sendEncrypted(
  tx: BluetoothRemoteGATTCharacteristic,
  wire: Uint8Array,
): Promise<void> {
  await sendFrame(tx, wire)
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

  // ── Phase 1: PRE_COMM ────────────────────────────────────────────────
  const bootstrapKey = await deriveSessionKey(deviceName, FW_DATA)
  const challenge = randomBytes(16)
  const preCommFrame = buildFrame(ADDR.BLE, ADDR.APP, CMD_PRE_COMM, challenge)
  const preCommWire = await encryptBootstrapFrame(
    bootstrapKey,
    preCommFrame,
    FW_DATA,
  )

  await sendEncrypted(tx, preCommWire)
  const preCommResponseWire = await waitForEncryptedFrame(rx, 5000)
  const preCommPlain = await decryptBootstrapFrame(
    bootstrapKey,
    preCommResponseWire,
    FW_DATA,
  )

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

  // ── Phase 2: SET_PWD ─────────────────────────────────────────────────
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

  await sendEncrypted(tx, setPwdWire)
  const setPwdResponseWire = await waitForEncryptedFrame(rx, 10000)
  const { plaintext: setPwdPlain, recvCounter: afterSetPwdRx } =
    await unwrapEncryptedFrame(phaseKey, counter, setPwdResponseWire, authParam)
  counter = afterSetPwdRx

  const setPwdParsed = parseFrame(setPwdPlain)
  if (setPwdParsed === null || setPwdParsed.cmd !== CMD_SET_PWD) {
    throw new Error('Ungültige SET_PWD-Antwort')
  }
  if (!isAccepted(setPwdParsed.data)) {
    throw new Error('SET_PWD abgelehnt')
  }

  // ── Phase 3: AUTH ────────────────────────────────────────────────────
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

  await sendEncrypted(tx, authWire)
  const authResponseWire = await waitForEncryptedFrame(rx, 5000)
  const { plaintext: authPlain, recvCounter: finalCounter } =
    await unwrapEncryptedFrame(sessionKey, counter, authResponseWire, authParam)

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
