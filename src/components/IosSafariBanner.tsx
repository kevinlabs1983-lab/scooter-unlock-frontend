import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  BLUEFY_APP_STORE_URL,
  dismissIosBluefyBanner,
  isIosBluefyBannerDismissed,
  isIosOrSafari,
} from '../lib/ios-safari-detect.ts'

export function IosSafariBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isIosBluefyBannerDismissed() || !isIosOrSafari()) {
      return
    }

    setVisible(true)
  }, [])

  if (!visible) {
    return null
  }

  const handleDismiss = () => {
    dismissIosBluefyBanner()
    setVisible(false)
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <span className="mt-0.5 shrink-0 text-lg leading-none" aria-hidden>
          ⚠️
        </span>

        <div className="min-w-0 flex-1 text-sm leading-relaxed">
          <p>
            Web Bluetooth wird von Safari/iOS nicht unterstützt. Nutze die kostenlose App{' '}
            <strong className="font-semibold text-amber-50">Bluefy</strong> – Browser with BLE,
            dann funktioniert der Tuner auch auf deinem iPhone/iPad.
          </p>
          <a
            href={BLUEFY_APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-500/25"
          >
            Bluefy im App Store
          </a>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-amber-200/80 transition-colors hover:bg-amber-500/20 hover:text-amber-50"
          aria-label="Hinweis schließen"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
