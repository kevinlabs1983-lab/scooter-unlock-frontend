// Nordic UART (ältere Ninebot / Xiaomi Firmware)
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
export const NORDIC_UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
export const NORDIC_UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

// Ninebot Custom (neuere Hardware, Notify oft auf 0004 statt 0003)
export const NINEBOT_CUSTOM_SERVICE_UUID = '6e400001-0000-0000-006e-696e65626f74'
export const NINEBOT_CUSTOM_TX_CHAR_UUID = '6e400002-0000-0000-006e-696e65626f74'
export const NINEBOT_CUSTOM_RX_CHAR_UUID = '6e400004-0000-0000-006e-696e65626f74'
export const NINEBOT_CUSTOM_RX_FALLBACK_CHAR_UUID =
  '6e400003-0000-0000-006e-696e65626f74'

/** @deprecated Alias für Nordic UART — bitte NINEBOT_BLE_PROFILES nutzen */
export const NINEBOT_SERVICE_UUID = NORDIC_UART_SERVICE_UUID
/** @deprecated */
export const NINEBOT_TX_CHAR_UUID = NORDIC_UART_TX_CHAR_UUID
/** @deprecated */
export const NINEBOT_RX_CHAR_UUID = NORDIC_UART_RX_CHAR_UUID

export interface NinebotBleProfile {
  id: string
  serviceUuid: string
  txCharUuid: string
  rxCharUuids: string[]
}

export const NINEBOT_BLE_PROFILES: NinebotBleProfile[] = [
  {
    id: 'nordic-uart',
    serviceUuid: NORDIC_UART_SERVICE_UUID,
    txCharUuid: NORDIC_UART_TX_CHAR_UUID,
    rxCharUuids: [NORDIC_UART_RX_CHAR_UUID],
  },
  {
    id: 'ninebot-custom',
    serviceUuid: NINEBOT_CUSTOM_SERVICE_UUID,
    txCharUuid: NINEBOT_CUSTOM_TX_CHAR_UUID,
    rxCharUuids: [NINEBOT_CUSTOM_RX_CHAR_UUID, NINEBOT_CUSTOM_RX_FALLBACK_CHAR_UUID],
  },
]

export const NINEBOT_BLE_SERVICE_UUIDS = NINEBOT_BLE_PROFILES.map(
  (profile) => profile.serviceUuid,
)

// Adressierung der Boards
export const ADDR = {
  BLE: 0x3e, // BLE Modul (Dashboard)
  ESC: 0x3d, // Motor Controller
  BMS: 0x3c, // Battery Management System
  APP: 0x3b, // App (wir selbst)
} as const

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Bekannte Scooter-Modelle anhand BLE Name
export const SCOOTER_MODELS: Record<string, string> = {
  'NBx-': 'Ninebot Max G30 Serie',
  'NB-': 'Ninebot F/G2 Serie',
  'YDx-': 'Xiaomi M365 Serie',
}
