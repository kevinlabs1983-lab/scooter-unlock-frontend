import { useCallback } from 'react'
import { USE_MOCK } from '../lib/ble/constants.ts'
import { connectToMockScooter } from '../lib/ble/mock-device.ts'
import { connectToScooter } from '../lib/ble/transport.ts'
import { performHandshake } from '../lib/crypto/handshake.ts'
import { getDeviceInfo } from '../lib/protocol/commands.ts'
import {
  useBluetoothStore,
  type BluetoothStatus,
  type LogEntry,
} from '../store/bluetoothStore.ts'

export function useBluetooth() {
  const status = useBluetoothStore((state) => state.status)
  const device = useBluetoothStore((state) => state.device)
  const session = useBluetoothStore((state) => state.session)
  const deviceInfo = useBluetoothStore((state) => state.deviceInfo)
  const error = useBluetoothStore((state) => state.error)
  const logs = useBluetoothStore((state) => state.logs)

  const connect = useCallback(async () => {
    const store = useBluetoothStore.getState()
    let connectedDevice: BluetoothDevice | null = null

    store.setError(null)
    store.setStatus('connecting')
    store.addLog(
      'info',
      USE_MOCK ? 'Mock-Scooter wird verbunden…' : 'BLE-Gerät wird gesucht…',
    )

    try {
      if (USE_MOCK) {
        console.log('[BT] connectToMockScooter...')
        const connection = await connectToMockScooter()
        connectedDevice = connection.device
        store.setDevice(connection.device)
        store.addLog('info', `Gerät gefunden: ${connection.device.name ?? 'Unbekannt'}`)

        store.setStatus('handshake')
        store.addLog('info', 'Verschlüsselter Handshake wird durchgeführt…')

        const deviceName = connection.device.name ?? 'Ninebot'
        console.log('[BT] performHandshake...')
        const sessionState = await performHandshake(
          connection.txChar,
          connection.rxChar,
          deviceName,
        )
        store.setSession(sessionState)
        store.addLog('success', `Handshake abgeschlossen (SN: ${sessionState.serial})`)

        store.setStatus('connected')
        store.addLog('info', 'Geräteinformationen werden gelesen…')

        console.log('[BT] getDeviceInfo...')
        const info = await getDeviceInfo(sessionState)
        store.setDeviceInfo(info)
        store.addLog(
          'success',
          `Verbunden — DRV ${info.firmwareDrv}, BLE ${info.firmwareBle}, BMS ${info.firmwareBms}`,
        )
        console.log('[BT] DONE', info)
      } else {
        console.log('[BT] connectToScooter...')
        const connection = await connectToScooter()
        connectedDevice = connection.device
        store.setDevice(connection.device)
        store.addLog('info', `Gerät gefunden: ${connection.device.name ?? 'Unbekannt'}`)

        store.setStatus('handshake')
        store.addLog('info', 'Verschlüsselter Handshake wird durchgeführt…')

        const deviceName = connection.device.name ?? 'Ninebot'
        console.log('[BT] performHandshake...')
        const sessionState = await performHandshake(
          connection.txChar,
          connection.rxChar,
          deviceName,
        )
        store.setSession(sessionState)
        store.addLog('success', `Handshake abgeschlossen (SN: ${sessionState.serial})`)

        store.setStatus('connected')
        store.addLog('info', 'Geräteinformationen werden gelesen…')

        console.log('[BT] getDeviceInfo...')
        const info = await getDeviceInfo(sessionState)
        store.setDeviceInfo(info)
        store.addLog(
          'success',
          `Verbunden — DRV ${info.firmwareDrv}, BLE ${info.firmwareBle}, BMS ${info.firmwareBms}`,
        )
        console.log('[BT] DONE', info)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      store.setError(message)
      store.setStatus('error')
      store.addLog('error', message)
      connectionCleanup(connectedDevice)
      store.resetConnection()
    }
  }, [])

  const disconnect = useCallback(() => {
    const store = useBluetoothStore.getState()
    connectionCleanup(store.device)
    store.resetConnection()
    store.setStatus('disconnected')
    store.addLog('info', 'Verbindung getrennt')
  }, [])

  const clearLogs = useCallback(() => {
    useBluetoothStore.getState().clearLogs()
  }, [])

  return {
    status,
    device,
    session,
    deviceInfo,
    error,
    logs,
    connect,
    disconnect,
    clearLogs,
  }
}

function connectionCleanup(device: BluetoothDevice | null) {
  try {
    device?.gatt?.disconnect()
  } catch {
    // Gerät war bereits getrennt
  }
}

export type { BluetoothStatus, LogEntry }
