import { useCallback, useEffect, useRef } from 'react'
import { USE_MOCK } from '../lib/ble/constants.ts'
import { connectToMockScooter } from '../lib/ble/mock-device.ts'
import {
  closeBleRelay,
  connectToScooter,
  isRelaySession,
} from '../lib/ble/transport.ts'
import { bleDebugError, bleDebugLog, bleDebugSuccess } from '../lib/ble/debug-log.ts'
import type { SessionState } from '../lib/crypto/handshake.ts'
import { getDeviceInfo } from '../lib/protocol/commands.ts'
import {
  useBluetoothStore,
  type BluetoothStatus,
  type LogEntry,
} from '../store/bluetoothStore.ts'

let activeDisconnectDevice: BluetoothDevice | null = null
let activeDisconnectHandler: ((event: Event) => void) | null = null
let activeRelayWs: WebSocket | null = null

function removeDisconnectListener(device: BluetoothDevice | null = activeDisconnectDevice) {
  if (!device || !activeDisconnectHandler) {
    return
  }
  device.removeEventListener('gattserverdisconnected', activeDisconnectHandler)
  if (device === activeDisconnectDevice) {
    activeDisconnectDevice = null
    activeDisconnectHandler = null
  }
}

function attachDisconnectListener(
  bleDevice: BluetoothDevice,
  onDisconnected: () => void,
): void {
  removeDisconnectListener(activeDisconnectDevice)
  activeDisconnectHandler = () => onDisconnected()
  activeDisconnectDevice = bleDevice
  bleDevice.addEventListener('gattserverdisconnected', activeDisconnectHandler)
}

export function useBluetooth() {
  const status = useBluetoothStore((state) => state.status)
  const device = useBluetoothStore((state) => state.device)
  const session = useBluetoothStore((state) => state.session)
  const deviceInfo = useBluetoothStore((state) => state.deviceInfo)
  const error = useBluetoothStore((state) => state.error)
  const logs = useBluetoothStore((state) => state.logs)
  const showPowerButtonModal = useBluetoothStore((state) => state.showPowerButtonModal)

  const deviceInfoLoadRef = useRef(0)

  const handleGattDisconnected = useCallback(() => {
    const store = useBluetoothStore.getState()
    if (store.status !== 'connected' && store.status !== 'handshake') {
      return
    }

    deviceInfoLoadRef.current += 1
    removeDisconnectListener(store.device)
    closeBleRelay(activeRelayWs)
    activeRelayWs = null
    store.resetConnection()
    store.setStatus('disconnected')
    store.addLog('warn', 'Bluetooth-Verbindung verloren — bitte erneut verbinden.')
  }, [])

  const connect = useCallback(async (licenseKey?: string) => {
    const store = useBluetoothStore.getState()

    if (
      store.status === 'connected' ||
      store.status === 'connecting' ||
      store.status === 'handshake'
    ) {
      return
    }

    let connectedDevice: BluetoothDevice | null = null

    store.clearLogs()
    store.setError(null)
    store.setStatus('connecting')
    bleDebugLog('Verbindung gestartet…')

    try {
      store.setStatus('handshake')
      if (USE_MOCK) {
        bleDebugLog('Mock-Modus aktiv')
        const { connection, session: sessionState } = await connectToMockScooter()
        connectedDevice = connection.device
        store.setDevice(connection.device)
        store.setSession(sessionState)
        store.setStatus('connected')
        bleDebugSuccess(`Verbunden (Mock) — SN: ${sessionState.serial}`)
        attachDisconnectListener(connection.device, handleGattDisconnected)
      } else {
        const { connection, session: sessionState, relayWs } = await connectToScooter(
          undefined,
          licenseKey?.trim() || undefined,
        )
        connectedDevice = connection.device
        activeRelayWs = relayWs ?? null
        store.setDevice(connection.device)
        store.setSession(sessionState)

        if (isRelaySession(sessionState)) {
          store.setDeviceInfo({
            serial: sessionState.serial,
            firmwareDrv: '—',
            firmwareBle: '—',
            firmwareBms: '—',
          })
          if (sessionState.patchConfig) {
            store.addLog(
              'success',
              `Relay-Tuning: Speed ${sessionState.patchConfig.speedLimit} km/h`,
            )
          }
        }

        store.setStatus('connected')
        bleDebugSuccess(
          isRelaySession(sessionState)
            ? `Verbunden (Relay) — SN: ${sessionState.serial}, Profil: ${connection.bleProfileId}`
            : `Verbunden — Protokoll: ${(sessionState as SessionState).protocol}, Profil: ${connection.bleProfileId}`,
        )
        attachDisconnectListener(connection.device, handleGattDisconnected)
      }
    } catch (err) {
      bleDebugError('Verbindung fehlgeschlagen', err)
      closeBleRelay(activeRelayWs)
      activeRelayWs = null
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = isHandshakeFailure(rawMessage)
        ? 'Verbindung fehlgeschlagen - bitte erneut versuchen'
        : rawMessage
      connectionCleanup(connectedDevice)
      store.resetConnection()
      store.setStatus('error')
      store.setError(message)
      store.addLog('error', `[BLE] FEHLER: ${message}`)
      if (message !== rawMessage) {
        store.addLog('error', `[BLE] Detail: ${rawMessage}`)
      }
    }
  }, [handleGattDisconnected])

  const disconnect = useCallback(() => {
    const store = useBluetoothStore.getState()
    deviceInfoLoadRef.current += 1
    removeDisconnectListener(store.device)
    closeBleRelay(activeRelayWs)
    activeRelayWs = null
    connectionCleanup(store.device)
    store.resetConnection()
    store.setDeviceInfo(null)
    store.setStatus('disconnected')
    store.addLog('info', 'Verbindung getrennt')
  }, [])

  useEffect(() => {
    if (status !== 'connected' || !session || deviceInfo) {
      return
    }

    if (isRelaySession(session)) {
      return
    }

    const loadId = ++deviceInfoLoadRef.current
    const activeSession = session

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
    showPowerButtonModal,
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
    message.includes('Bootstrap') ||
    message.includes('MAC-Verifikation') ||
    message.includes('Timeout') ||
    message.includes('Ninebot BLE') ||
    message.includes('Notify') ||
    message.includes('Gerätename') ||
    message.includes('Relay') ||
    message.includes('WebSocket') ||
    message.includes('Lizenz')
  )
}
