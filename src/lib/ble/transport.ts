import { performHandshake, type SessionState } from '../crypto/handshake.ts'
import {
  closeBleRelay,
  connectViaBleRelay,
  isRelaySession,
  type RelaySessionState,
} from './bleRelay.ts'
import {
  NINEBOT_BLE_PROFILES,
  NINEBOT_BLE_SERVICE_UUIDS,
  type NinebotBleProfile,
} from './constants.ts'
import { bleDebugError, bleDebugLog, bleDebugSuccess, bleDebugWarn } from './debug-log.ts'

export interface ScooterConnection {
  device: BluetoothDevice
  txChar: BluetoothRemoteGATTCharacteristic
  rxChar: BluetoothRemoteGATTCharacteristic
  bleProfileId: string
}

export interface ConnectedScooter {
  connection: ScooterConnection
  session: SessionState | RelaySessionState
  relayWs?: WebSocket
}

/** Bekannte Max-G3 BLE-Namenspräfixe (Seriennummern-Schema). */
export const MAX_G3_BLE_PREFIXES = ['NBE-', '1CGBC', 'NBG3-'] as const

export function matchesMaxG3DeviceName(deviceName: string): boolean {
  return MAX_G3_BLE_PREFIXES.some((prefix) => deviceName.startsWith(prefix))
}

export function isNbg3LicenseKey(licenseKey?: string): boolean {
  return licenseKey?.trim().startsWith('NBG3-') ?? false
}

export type BleRelayReason = 'Gerätename' | 'Lizenzkey' | 'Gerätename + Lizenzkey'

/** Relay wenn Lizenz vorhanden und (G3-Gerätename oder NBG3-Schlüssel). */
export function shouldUseBleRelay(
  deviceName: string,
  licenseKey?: string,
): { useRelay: boolean; reason: BleRelayReason | null } {
  const key = licenseKey?.trim()
  if (!key) {
    return { useRelay: false, reason: null }
  }

  const byName = matchesMaxG3DeviceName(deviceName)
  const byKey = isNbg3LicenseKey(key)

  if (byKey && byName) {
    return { useRelay: true, reason: 'Gerätename + Lizenzkey' }
  }
  if (byKey) {
    return { useRelay: true, reason: 'Lizenzkey' }
  }
  if (byName) {
    return { useRelay: true, reason: 'Gerätename' }
  }

  return { useRelay: false, reason: null }
}

export function logBleRelayMode(reason: BleRelayReason): void {
  bleDebugLog(`Relay-Modus: JA (Grund: ${reason})`)
}

async function resolveNotifyCharacteristic(
  service: BluetoothRemoteGATTService,
  rxCharUuids: string[],
): Promise<BluetoothRemoteGATTCharacteristic> {
  let lastError: unknown = null

  for (const uuid of rxCharUuids) {
    try {
      const characteristic = await service.getCharacteristic(uuid)
      bleDebugSuccess(`Notify-Characteristic gefunden: ${uuid}`)
      return characteristic
    } catch (error) {
      lastError = error
      bleDebugWarn(`Notify-Characteristic ${uuid} nicht verfügbar`)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Notify-Characteristic nicht gefunden')
}

async function resolveNinebotProfile(
  gatt: BluetoothRemoteGATTServer,
): Promise<{
  profile: NinebotBleProfile
  txChar: BluetoothRemoteGATTCharacteristic
  rxChar: BluetoothRemoteGATTCharacteristic
}> {
  let lastError: unknown = null

  bleDebugLog('Suche Ninebot BLE-Profile…')

  for (const profile of NINEBOT_BLE_PROFILES) {
    try {
      bleDebugLog(`Profil testen: ${profile.id} (${profile.serviceUuid})`)
      const service = await gatt.getPrimaryService(profile.serviceUuid)
      const txChar = await service.getCharacteristic(profile.txCharUuid)
      bleDebugSuccess(`TX-Characteristic: ${profile.txCharUuid}`)
      const rxChar = await resolveNotifyCharacteristic(service, profile.rxCharUuids)
      bleDebugSuccess(`Profil aktiv: ${profile.id}`)
      return { profile, txChar, rxChar }
    } catch (error) {
      lastError = error
      bleDebugWarn(`Profil ${profile.id} fehlgeschlagen`)
      bleDebugError(`Profil ${profile.id}`, error)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Ninebot BLE-Service nicht gefunden')
}

export async function connectToScooter(
  deviceNameHint?: string,
  licenseKey?: string,
): Promise<ConnectedScooter> {
  bleDebugLog('Öffne BLE-Geräteauswahl…')

  const device = await navigator.bluetooth.requestDevice({
    filters: NINEBOT_BLE_SERVICE_UUIDS.map((serviceUuid) => ({ services: [serviceUuid] })),
    optionalServices: NINEBOT_BLE_SERVICE_UUIDS,
  })

  const deviceName = deviceNameHint ?? device.name?.trim()
  if (!deviceName) {
    throw new Error('BLE-Gerätename fehlt — Handshake nicht möglich')
  }

  bleDebugSuccess(`Gerät gewählt: ${deviceName} (ID: ${device.id})`)

  if (!device.gatt) {
    throw new Error('GATT nicht verfügbar')
  }

  bleDebugLog('GATT-Verbindung wird aufgebaut…')
  const gatt = await device.gatt.connect()
  bleDebugSuccess('GATT connected')

  const { profile, txChar, rxChar } = await resolveNinebotProfile(gatt)

  bleDebugLog('Starte Notifications…')
  await rxChar.startNotifications()
  await new Promise((resolve) => setTimeout(resolve, 150))
  bleDebugSuccess('Notifications gestartet (150ms stabilisiert)')

  const connection: ScooterConnection = {
    device,
    txChar,
    rxChar,
    bleProfileId: profile.id,
  }

  const relayDecision = shouldUseBleRelay(deviceName, licenseKey)
  if (relayDecision.useRelay && relayDecision.reason) {
    if (relayDecision.reason !== 'Lizenzkey') {
      logBleRelayMode(relayDecision.reason)
    }
    bleDebugLog('Versuche BLE-Relay (Max G3)…')
    try {
      const relay = await connectViaBleRelay(licenseKey!.trim(), connection, deviceName)
      bleDebugSuccess(`Relay OK — SN: ${relay.session.serial}`)
      return {
        connection,
        session: relay.session,
        relayWs: relay.ws,
      }
    } catch (relayError) {
      bleDebugError('BLE-Relay fehlgeschlagen — Fallback lokal', relayError)
      bleDebugWarn('Fallback auf lokalen Handshake (G30/Encryption2)…')
    }
  }

  bleDebugLog(`Starte lokalen Handshake (Profil: ${profile.id}, Name: ${deviceName})…`)
  const session = await performHandshake(txChar, rxChar, deviceName)
  bleDebugSuccess(`Handshake OK — Protokoll: ${session.protocol}, SN: ${session.serial}`)

  return { connection, session }
}

export async function sendFrame(
  char: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array,
): Promise<void> {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer
  await char.writeValueWithoutResponse(buffer)
}

export function onNotify(
  char: BluetoothRemoteGATTCharacteristic,
  callback: (data: Uint8Array) => void,
): void {
  char.addEventListener('characteristicvaluechanged', (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    if (target.value) {
      const { buffer, byteOffset, byteLength } = target.value
      callback(new Uint8Array(buffer, byteOffset, byteLength))
    }
  })
}

export { closeBleRelay, isRelaySession }
export type { RelaySessionState }
