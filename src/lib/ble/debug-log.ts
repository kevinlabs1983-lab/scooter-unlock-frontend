import { useBluetoothStore, type LogLevel } from '../../store/bluetoothStore.ts'

export function bleDebugLog(message: string, level: LogLevel = 'info'): void {
  const line = `[BLE] ${message}`
  console.log(line)
  useBluetoothStore.getState().addLog(level, line)
}

export function bleDebugWarn(message: string): void {
  bleDebugLog(message, 'warn')
}

export function bleDebugSuccess(message: string): void {
  bleDebugLog(message, 'success')
}

export function bleDebugError(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error)
  bleDebugLog(`${context}: ${detail}`, 'error')
  console.error(`[BLE] ${context}`, error)
}
