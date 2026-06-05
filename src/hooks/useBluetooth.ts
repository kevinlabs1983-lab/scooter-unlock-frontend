import { useCallback, useEffect, useRef } from 'react'
import { USE_MOCK } from '../lib/ble/constants.ts'
import { connectToMockScooter } from '../lib/ble/mock-device.ts'
import { connectToScooter } from '../lib/ble/transport.ts'
import type { SessionState } from '../lib/crypto/handshake.ts'
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

  const disconnectListenerRef = useRef<((event: Event) => void) | null>(null)
  const deviceInfoLoadRef = useRef(0)

  const removeDisconnectListener = useCallback((device: BluetoothDevice | null) => {
    if (!device || !disconnectListenerRef.current) {
      return
    }
    device.removeEventListener('gattserverdisconnected', disconnectListenerRef.current)
    disconnectListenerRef.current = null
  }, [])

  const handleGattDisconnected = useCallback(() => {
    const store = useBluetoothStore.getState()
    if (store.status !== 'connected' && store.status !== 'handshake') {
      return
    }

    deviceInfoLoadRef.current += 1
    removeDisconnectListener(store.device)
    store.resetConnection()
    store.setStatus('disconnected')
    store.addLog('warn', 'Bluetooth-Verbindung verloren — bitte erneut verbinden.')
  }, [removeDisconnectListener])

  const attachDisconnectListener = useCallback(
    (bleDevice: BluetoothDevice) => {
      removeDisconnectListener(bleDevice)
      const handler = () => handleGattDisconnected()
      disconnectListenerRef.current = handler
      bleDevice.addEventListener('gattserverdisconnected', handler)
    },
    [handleGattDisconnected, removeDisconnectListener],
  )

  const connect = useCallback(async () => {
    const store = useBluetoothStore.getState()

    if (
      store.status === 'connected' ||
      store.status === 'connecting' ||
      store.status === 'handshake'
    ) {
      return
    }

    let connectedDevice: BluetoothDevice | null = null

    store.setError(null)
    store.setStatus('connecting')
    store.addLog(
      'info',
      USE_MOCK ? 'Mock-Scooter wird verbunden…' : 'BLE-Gerät wird gesucht…',
    )

    try {
      store.setStatus('handshake')
      if (USE_MOCK) {
        const { connection, session: sessionState } = await connectToMockScooter()
        connectedDevice = connection.device
        store.setDevice(connection.device)
        store.setSession(sessionState)
        store.setStatus('connected')
        store.addLog('success', `Handshake abgeschlossen (SN: ${sessionState.serial})`)
        attachDisconnectListener(connection.device)
      } else {
        const { connection, session: sessionState } = await connectToScooter()
        connectedDevice = connection.device
        store.setDevice(connection.device)
        store.setSession(sessionState)
        store.setStatus('connected')
        store.addLog('success', `Handshake abgeschlossen (SN: ${sessionState.serial})`)
        attachDisconnectListener(connection.device)
      }
    } catch (err) {
      console.error('BLE handshake/connect failed', err)
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = isHandshakeFailure(rawMessage)
        ? 'Verbindung fehlgeschlagen - bitte erneut versuchen'
        : rawMessage
      connectionCleanup(connectedDevice)
      store.resetConnection()
      store.setStatus('error')
      store.setError(message)
      store.addLog('error', message)
    }
  }, [attachDisconnectListener])

  const disconnect = useCallback(() => {
    const store = useBluetoothStore.getState()
    deviceInfoLoadRef.current += 1
    removeDisconnectListener(store.device)
    connectionCleanup(store.device)
    store.resetConnection()
    store.setDeviceInfo(null)
    store.setStatus('disconnected')
    store.addLog('info', 'Verbindung getrennt')
  }, [removeDisconnectListener])

  useEffect(() => {
    if (status !== 'connected' || !session || deviceInfo) {
      return
    }

    const loadId = ++deviceInfoLoadRef.current
    const activeSession: SessionState = session

    const timeoutId = window.setTimeout(() => {
      void getDeviceInfo(activeSession)
        .then((info) => {
          const current = useBluetoothStore.getState()
          if (loadId !== deviceInfoLoadRef.current || current.status !== 'connected') {
            return
          }
          current.setDeviceInfo(info)
          current.addLog(
            'success',
            `Verbunden — DRV ${info.firmwareDrv}, BLE ${info.firmwareBle}, BMS ${info.firmwareBms}`,
          )
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err)
          useBluetoothStore.getState().addLog('warn', `Geräteinfo: ${message}`)
        })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status, session, deviceInfo])

  useEffect(
    () => () => {
      const bleDevice = useBluetoothStore.getState().device
      removeDisconnectListener(bleDevice)
    },
    [removeDisconnectListener],
  )

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

function isHandshakeFailure(message: string): boolean {
  return (
    message.includes('Handshake') ||
    message.includes('PRE_COMM') ||
    message.includes('SET_PWD') ||
    message.includes('AUTH') ||
    message.includes('Timeout')
  )
}
