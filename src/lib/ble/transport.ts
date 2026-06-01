import {
  NINEBOT_RX_CHAR_UUID,
  NINEBOT_SERVICE_UUID,
  NINEBOT_TX_CHAR_UUID,
} from './constants.ts'

export interface ScooterConnection {
  device: BluetoothDevice
  txChar: BluetoothRemoteGATTCharacteristic
  rxChar: BluetoothRemoteGATTCharacteristic
}

export async function connectToScooter(): Promise<ScooterConnection> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [NINEBOT_SERVICE_UUID] }],
    optionalServices: [NINEBOT_SERVICE_UUID],
  })

  const server = device.gatt?.connect()
  if (!server) {
    throw new Error('GATT nicht verfügbar')
  }

  const gatt = await server
  const service = await gatt.getPrimaryService(NINEBOT_SERVICE_UUID)
  const txChar = await service.getCharacteristic(NINEBOT_TX_CHAR_UUID)
  const rxChar = await service.getCharacteristic(NINEBOT_RX_CHAR_UUID)

  await rxChar.startNotifications()

  return { device, txChar, rxChar }
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
