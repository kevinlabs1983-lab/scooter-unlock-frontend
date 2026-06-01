import { create } from 'zustand'
import type { SessionState } from '../lib/crypto/handshake.ts'
import type { DeviceInfo } from '../lib/protocol/commands.ts'

export type BluetoothStatus =
  | 'idle'
  | 'connecting'
  | 'handshake'
  | 'connected'
  | 'error'
  | 'disconnected'

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
}

interface BluetoothStoreState {
  status: BluetoothStatus
  device: BluetoothDevice | null
  session: SessionState | null
  deviceInfo: DeviceInfo | null
  error: string | null
  logs: LogEntry[]
}

interface BluetoothStoreActions {
  setStatus: (status: BluetoothStatus) => void
  setDevice: (device: BluetoothDevice | null) => void
  setSession: (session: SessionState | null) => void
  setDeviceInfo: (deviceInfo: DeviceInfo | null) => void
  setError: (error: string | null) => void
  addLog: (level: LogLevel, message: string) => void
  clearLogs: () => void
  resetConnection: () => void
}

const initialState: BluetoothStoreState = {
  status: 'idle',
  device: null,
  session: null,
  deviceInfo: null,
  error: null,
  logs: [],
}

export const useBluetoothStore = create<BluetoothStoreState & BluetoothStoreActions>(
  (set) => ({
    ...initialState,
    setStatus: (status) => set({ status }),
    setDevice: (device) => set({ device }),
    setSession: (session) => set({ session }),
    setDeviceInfo: (deviceInfo) => set({ deviceInfo }),
    setError: (error) => set({ error }),
    addLog: (level, message) =>
      set((state) => ({
        logs: [
          ...state.logs,
          {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            message,
          },
        ],
      })),
    clearLogs: () => set({ logs: [] }),
    resetConnection: () =>
      set({
        device: null,
        session: null,
        deviceInfo: null,
        error: null,
      }),
  }),
)
