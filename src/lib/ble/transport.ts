import { performHandshake, type SessionState } from '../crypto/handshake.ts'
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
  session: SessionState
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
  bleDebugSuccess('Notifications gestartet')

  bleDebugLog(`Starte Handshake (Profil: ${profile.id}, Name: ${deviceName})…`)
  const session = await performHandshake(txChar, rxChar, deviceName)
  bleDebugSuccess(
    `Handshake OK — Protokoll: ${session.protocol}, SN: ${session.serial}`,
  )

  return {
    connection: { device, txChar, rxChar, bleProfileId: profile.id },
    session,
  }
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
