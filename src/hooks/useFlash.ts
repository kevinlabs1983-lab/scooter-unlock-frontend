import { useCallback } from 'react'
import {
  flashFirmware,
  verifyFirmware,
  type FlashTarget,
} from '../lib/protocol/firmware.ts'
import { useBluetoothStore } from '../store/bluetoothStore.ts'
import { useFlashStore, type FlashStatus } from '../store/flashStore.ts'

export function useFlash() {
  const flashStatus = useFlashStore((state) => state.flashStatus)
  const progress = useFlashStore((state) => state.progress)
  const currentChunk = useFlashStore((state) => state.currentChunk)
  const totalChunks = useFlashStore((state) => state.totalChunks)
  const error = useFlashStore((state) => state.error)

  const startFlash = useCallback(
    async (firmwareBlob: Uint8Array, target: FlashTarget) => {
      const bluetooth = useBluetoothStore.getState()
      const flash = useFlashStore.getState()

      if (!bluetooth.session) {
        flash.setFlashStatus('error')
        flash.setError('Keine aktive BLE-Session — zuerst verbinden')
        bluetooth.addLog('error', 'Flash abgebrochen: nicht verbunden')
        return
      }

      flash.resetFlash()
      flash.setFlashStatus('preparing')
      bluetooth.addLog('info', `Firmware-Flash vorbereiten (${target})…`)

      try {
        if (flash.cancelRequested) {
          throw new Error('Flash abgebrochen')
        }

        flash.setFlashStatus('flashing')
        bluetooth.addLog('info', `Flash gestartet — ${firmwareBlob.length} Bytes`)

        const result = await flashFirmware(
          bluetooth.session,
          firmwareBlob,
          target,
          (percent, chunk, total) => {
            const state = useFlashStore.getState()
            if (state.cancelRequested) {
              throw new Error('Flash abgebrochen')
            }
            state.setProgress(percent, chunk, total)
          },
          () => useFlashStore.getState().cancelRequested,
        )

        if (useFlashStore.getState().cancelRequested) {
          throw new Error('Flash abgebrochen')
        }

        if (!result.success) {
          throw new Error(result.error ?? 'Flash fehlgeschlagen')
        }

        flash.setFlashStatus('verifying')
        bluetooth.addLog('info', 'Firmware wird verifiziert…')

        const verified = await verifyFirmware(bluetooth.session)
        if (!verified) {
          throw new Error('Firmware-Verifikation fehlgeschlagen')
        }

        flash.setFlashStatus('done')
        const { currentChunk, totalChunks } = useFlashStore.getState()
        flash.setProgress(100, currentChunk, totalChunks)
        bluetooth.addLog(
          'success',
          `Flash abgeschlossen${result.newVersion ? ` — Version ${result.newVersion}` : ''}`,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        flash.setFlashStatus('error')
        flash.setError(message)
        bluetooth.addLog('error', message)
      }
    },
    [],
  )

  const cancelFlash = useCallback(() => {
    const flash = useFlashStore.getState()
    flash.requestCancel()
    if (flash.flashStatus === 'flashing' || flash.flashStatus === 'preparing') {
      useBluetoothStore.getState().addLog('warn', 'Flash-Abbruch angefordert…')
    }
  }, [])

  return {
    flashStatus,
    progress,
    currentChunk,
    totalChunks,
    error,
    startFlash,
    cancelFlash,
  }
}

export type { FlashStatus, FlashTarget }
