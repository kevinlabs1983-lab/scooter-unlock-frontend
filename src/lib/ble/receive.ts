import { sendFrame } from './transport.ts'

export interface WaitFrameOptions {
  /** Wartezeit nach letztem Fragment (Bluefy) */
  debounceMs?: number
  /** Vollständigkeitsprüfung auf akkumuliertem Wire-Buffer */
  isComplete?: (buffer: Uint8Array) => boolean
}

function copyBytes(data: Uint8Array): Uint8Array {
  const copy = new Uint8Array(data.length)
  copy.set(data)
  return copy
}

function appendBuffer(existing: Uint8Array, chunk: Uint8Array): Uint8Array {
  if (existing.length === 0) {
    return copyBytes(chunk)
  }
  const merged = new Uint8Array(existing.length + chunk.length)
  merged.set(existing, 0)
  merged.set(chunk, existing.length)
  return merged
}

/** Prüft ob ein Ninebot Wire-Frame (0x55 0xAA) vollständig empfangen wurde. */
export function isNinebotWireFrameComplete(buffer: Uint8Array): boolean {
  if (buffer.length < 11 || buffer[0] !== 0x55 || buffer[1] !== 0xaa) {
    return false
  }

  const len = buffer[2] ?? 0
  if (len < 3) {
    return false
  }

  return buffer.length >= len + 11
}

/**
 * Registriert den Notify-Listener und akkumuliert Fragmente (Bluefy).
 * Promise vor dem Senden starten, dann sendFrame, dann await.
 */
export function startWaitingForEncryptedFrame(
  rx: BluetoothRemoteGATTCharacteristic,
  timeoutMs: number,
  options: WaitFrameOptions = {},
): Promise<Uint8Array> {
  const { debounceMs = 80, isComplete = isNinebotWireFrameComplete } = options

  return new Promise((resolve, reject) => {
    let settled = false
    let buffer: Uint8Array = new Uint8Array(0)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      window.clearTimeout(hardTimeout)
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer)
        debounceTimer = null
      }
      rx.removeEventListener('characteristicvaluechanged', onChange)
    }

    const tryResolve = () => {
      if (settled || !isComplete(buffer)) {
        return
      }
      settled = true
      cleanup()
      resolve(copyBytes(buffer))
    }

    const scheduleDebounce = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer)
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        tryResolve()
      }, debounceMs)
    }

    const hardTimeout = window.setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(new Error('Handshake-Timeout'))
    }, timeoutMs)

    const onChange = (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      if (!target.value || settled) {
        return
      }

      const value = target.value
      const chunk = copyBytes(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
      )
      buffer = appendBuffer(buffer, chunk)

      if (isComplete?.(buffer)) {
        tryResolve()
        return
      }

      scheduleDebounce()
    }

    rx.addEventListener('characteristicvaluechanged', onChange)
  })
}

export async function sendAndWaitForEncryptedFrame(
  tx: BluetoothRemoteGATTCharacteristic,
  rx: BluetoothRemoteGATTCharacteristic,
  wire: Uint8Array,
  timeoutMs: number,
  options?: WaitFrameOptions,
): Promise<Uint8Array> {
  const responsePromise = startWaitingForEncryptedFrame(rx, timeoutMs, options)
  await sendFrame(tx, wire)
  return responsePromise
}
