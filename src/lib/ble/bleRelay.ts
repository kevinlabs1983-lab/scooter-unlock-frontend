import { DEFAULT_PRODUCTION_API_BASE, getApiBase } from '../api.ts'
import { NORDIC_UART_TX_CHAR_UUID, NORDIC_UART_RX_CHAR_UUID } from './constants.ts'
import { PROTOCOL_ENCRYPTION2, type NinebotProtocol } from './protocol-types.ts'
import { bleDebugError, bleDebugLog, bleDebugSuccess, bleDebugWarn, bytesToHex } from './debug-log.ts'
import type { SessionState } from '../crypto/handshake.ts'
import type { PatchConfig } from '../firmware-patcher.ts'
import { useBluetoothStore } from '../../store/bluetoothStore.ts'

const CHUNK_SIZE = 20
const CHUNK_DELAY_MS = 50
/** Wartezeit nach Notify-Listener, bevor das Backend den ersten WRITE sendet. */
const NOTIFY_BEFORE_WRITE_DELAY_MS = 200
/** Backend PRE_COMM-Notify-Timeout (muss mit bleSession.ts übereinstimmen). */
export const RELAY_NOTIFY_TIMEOUT_MS = 15_000

const PRE_COMM_WIRE_PREFIX = '5aa5003e215b00'

export interface BleRelayTransport {
  device: BluetoothDevice
  txChar: BluetoothRemoteGATTCharacteristic
  rxChar: BluetoothRemoteGATTCharacteristic
  bleProfileId: string
}

export type RelayServerMessage =
  | { type: 'write'; data: string }
  | { type: 'ui'; action: string }
  | { type: 'result'; success: boolean; params?: RelayResultParams }
  | { type: 'error'; message: string }
  | { type: 'status'; phase: string; message?: string; sessionId?: string }

export interface RelayResultParams {
  serial?: string
  deviceName?: string
  relay?: boolean
  patchConfig?: PatchConfig
  speedLimitApplied?: number
  error?: string
}

export interface RelaySessionState {
  mode: 'relay'
  protocol: NinebotProtocol
  serial: string
  deviceName: string
  tx: BluetoothRemoteGATTCharacteristic
  rx: BluetoothRemoteGATTCharacteristic
  patchConfig?: PatchConfig
  relayResult?: RelayResultParams
}

export interface BleRelayConnection {
  session: RelaySessionState
  ws: WebSocket
}

function getBleRelayWsUrl(licenseKey: string): string {
  const httpBase = getApiBase() || DEFAULT_PRODUCTION_API_BASE
  const wsBase = httpBase.replace(/^http/i, 'ws')
  return `${wsBase}/ble-relay?license=${encodeURIComponent(licenseKey)}`
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[\s-]/g, '')
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error('Ungültiger Hex-String vom Backend')
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function sendBleFrame(
  char: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
): Promise<void> {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer
  const writeUuid = char.uuid.toLowerCase()
  const isPreComm =
    data.length >= 7 &&
    bytesToHex(data.slice(0, 7)).toLowerCase().startsWith(PRE_COMM_WIRE_PREFIX)

  try {
    await char.writeValueWithoutResponse(buffer)
    if (writeUuid.includes('6e400002') || writeUuid === NORDIC_UART_TX_CHAR_UUID) {
      bleDebugLog('WRITE erfolgreich auf 6e400002')
    } else {
      bleDebugSuccess(`WRITE erfolgreich auf ${writeUuid}`)
    }
    if (isPreComm) {
      bleDebugLog(`PRE_COMM WRITE abgeschlossen (${data.length} B) — warte NOTIFY (max ${RELAY_NOTIFY_TIMEOUT_MS}ms)`)
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    bleDebugLog(`WRITE FEHLER: ${detail}`, 'error')
    throw error
  }
}

async function writeBleChunks(
  char: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
): Promise<void> {
  if (data.length <= CHUNK_SIZE) {
    await sendBleFrame(char, data)
    return
  }

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE)
    await sendBleFrame(char, chunk)
    if (offset + CHUNK_SIZE < data.length) {
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS))
    }
  }
}

export function isRelaySession(
  session: SessionState | RelaySessionState | null | undefined,
): session is RelaySessionState {
  return (
    session !== null &&
    session !== undefined &&
    'mode' in session &&
    (session as RelaySessionState).mode === 'relay'
  )
}

export async function connectViaBleRelay(
  licenseKey: string,
  connection: BleRelayTransport,
  deviceName: string,
): Promise<BleRelayConnection> {
  const { txChar, rxChar } = connection
  const wsUrl = getBleRelayWsUrl(licenseKey)
  bleDebugLog(`BLE-Relay: WebSocket ${wsUrl.replace(licenseKey, '***')}`)

  let ws: WebSocket | undefined

  const notifyHandler = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    if (!target.value) {
      return
    }
    const { buffer, byteOffset, byteLength } = target.value
    const bytes = new Uint8Array(buffer, byteOffset, byteLength)
    const hex = bytesToHex(bytes)
    bleDebugLog(`RAW NOTIFY: ${hex}`)

    if (ws?.readyState !== WebSocket.OPEN) {
      return
    }

    bleDebugLog(`BLE-Relay: NOTIFY (${bytes.length} B): ${hex}`)
    ws.send(JSON.stringify({ type: 'notify', data: hex.toLowerCase() }))
  }

  rxChar.addEventListener('characteristicvaluechanged', notifyHandler)
  const rxUuid = rxChar.uuid.toLowerCase()
  if (rxUuid.includes('6e400003') || rxUuid === NORDIC_UART_RX_CHAR_UUID) {
    bleDebugSuccess(`Notify-Subscription aktiv auf 6e400003 (${rxUuid})`)
  } else {
    bleDebugSuccess(`Notify-Subscription aktiv auf ${rxUuid}`)
  }

  await new Promise((resolve) => setTimeout(resolve, NOTIFY_BEFORE_WRITE_DELAY_MS))
  bleDebugLog(`Notify stabilisiert (${NOTIFY_BEFORE_WRITE_DELAY_MS}ms) — erster WRITE folgt`)

  let handshakeDone = false
  ws = new WebSocket(wsUrl)

  const relayPromise = new Promise<RelayResultParams>((resolve, reject) => {
    const fail = (message: string) => {
      if (!handshakeDone) {
        handshakeDone = true
        reject(new Error(message))
      }
    }

    ws.onopen = () => {
      bleDebugSuccess('BLE-Relay: WebSocket verbunden')
      ws!.send(JSON.stringify({ type: 'ready', deviceName }))
    }

    ws.onmessage = async (event) => {
      let message: RelayServerMessage
      try {
        message = JSON.parse(String(event.data)) as RelayServerMessage
      } catch {
        bleDebugWarn('BLE-Relay: Ungültige Server-Nachricht')
        return
      }

      if (message.type === 'status') {
        bleDebugLog(`BLE-Relay: ${message.phase}${message.message ? ` — ${message.message}` : ''}`)
        return
      }

      if (message.type === 'ui') {
        if (message.action === 'press_power_button') {
          bleDebugWarn('BLE-Relay: Power-Taste am Roller drücken!')
          useBluetoothStore.getState().setShowPowerButtonModal(true)
        }
        return
      }

      if (message.type === 'write') {
        try {
          const bytes = hexToBytes(message.data)
          bleDebugLog(`BLE-Relay: WRITE (${bytes.length} B): ${bytesToHex(bytes)}`)
          await writeBleChunks(txChar, bytes)
        } catch (error) {
          bleDebugError('BLE-Relay WRITE', error)
        }
        return
      }

      if (message.type === 'error') {
        fail(message.message)
        return
      }

      if (message.type === 'result') {
        handshakeDone = true
        if (message.success && message.params) {
          resolve(message.params)
        } else {
          reject(new Error(message.params?.error ?? 'Relay-Handshake fehlgeschlagen'))
        }
      }
    }

    ws.onerror = () => {
      fail('WebSocket-Fehler')
    }

    ws.onclose = () => {
      if (!handshakeDone) {
        fail('WebSocket geschlossen')
      }
    }
  })

  try {
    const relayResult = await relayPromise
    if (!relayResult.serial) {
      throw new Error('Keine Seriennummer vom Backend')
    }

    bleDebugSuccess(`BLE-Relay: OK — SN ${relayResult.serial}`)

    return {
      session: {
        mode: 'relay',
        protocol: PROTOCOL_ENCRYPTION2,
        serial: relayResult.serial,
        deviceName,
        tx: txChar,
        rx: rxChar,
        patchConfig: relayResult.patchConfig,
        relayResult,
      },
      ws: ws!,
    }
  } finally {
    rxChar.removeEventListener('characteristicvaluechanged', notifyHandler)
    useBluetoothStore.getState().setShowPowerButtonModal(false)
  }
}

export function closeBleRelay(ws: WebSocket | null | undefined): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close()
  }
}
