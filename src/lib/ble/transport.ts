import { performHandshake, type SessionState } from '../crypto/handshake.ts'
import {
  NINEBOT_BLE_PROFILES,
  NINEBOT_BLE_SERVICE_UUIDS,
  type NinebotBleProfile,
} from './constants.ts'

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
      console.log('BLE: notify characteristic', uuid)
      return characteristic
    } catch (error) {
      lastError = error
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

  for (const profile of NINEBOT_BLE_PROFILES) {
    try {
      const service = await gatt.getPrimaryService(profile.serviceUuid)
      const txChar = await service.getCharacteristic(profile.txCharUuid)
      const rxChar = await resolveNotifyCharacteristic(service, profile.rxCharUuids)
      console.log('BLE: profile', profile.id, 'service', profile.serviceUuid)
      return { profile, txChar, rxChar }
    } catch (error) {
      lastError = error
      console.warn('BLE: profile failed', profile.id, error)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Ninebot BLE-Service nicht gefunden')
}

export async function connectToScooter(
  deviceNameHint?: string,
): Promise<ConnectedScooter> {
  const device = await navigator.bluetooth.requestDevice({
    filters: NINEBOT_BLE_SERVICE_UUIDS.map((serviceUuid) => ({ services: [serviceUuid] })),
    optionalServices: NINEBOT_BLE_SERVICE_UUIDS,
  })

  const deviceName = deviceNameHint ?? device.name?.trim()
  if (!deviceName) {
    throw new Error('BLE-Gerätename fehlt — Handshake nicht möglich')
  }
  console.log('BLE: device selected', { id: device.id, name: deviceName })

  const server = device.gatt?.connect()
  if (!server) {
    throw new Error('GATT nicht verfügbar')
  }

  const gatt = await server
  console.log('BLE: GATT connected')

  const { profile, txChar, rxChar } = await resolveNinebotProfile(gatt)

  await rxChar.startNotifications()
  console.log('BLE: startNotifications done')

  const session = await performHandshake(txChar, rxChar, deviceName)

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
