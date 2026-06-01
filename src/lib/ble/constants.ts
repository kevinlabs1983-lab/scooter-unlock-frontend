// Ninebot UART Service (alle modernen Modelle)
export const NINEBOT_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
export const NINEBOT_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // App → Scooter
export const NINEBOT_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e' // Scooter → App

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
