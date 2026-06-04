export interface BrowserCheckResult {
  hasBluetooth: boolean
  isSecureContext: boolean
  isSupportedBrowser: boolean
  browserName: string
  issues: string[]
  isReady: boolean
}

function parseVersion(userAgent: string, pattern: RegExp): number {
  const match = userAgent.match(pattern)
  return match?.[1] ? Number.parseInt(match[1], 10) : 0
}

export function isBluefyBrowser(userAgent = navigator.userAgent): boolean {
  return /Bluefy/i.test(userAgent)
}

export function detectBrowser(userAgent = navigator.userAgent): {
  name: string
  supported: boolean
} {
  if (isBluefyBrowser(userAgent)) {
    return { name: 'Bluefy', supported: true }
  }

  const isOpera = /OPR\//.test(userAgent)
  const isEdge = /Edg\//.test(userAgent)
  const isSamsung = /SamsungBrowser\//.test(userAgent)
  const isChrome = /Chrome\//.test(userAgent) && !isEdge && !isOpera
  const isChromeAndroid =
    /Android/.test(userAgent) && isChrome && !isSamsung
  const isFirefox = /Firefox\//.test(userAgent)
  const isSafari =
    /Safari\//.test(userAgent) && !isChrome && !isEdge && !isOpera

  if (isChromeAndroid) {
    const version = parseVersion(userAgent, /Chrome\/(\d+)/)
    return {
      name: 'Chrome Android',
      supported: version >= 56,
    }
  }

  if (isEdge) {
    const version = parseVersion(userAgent, /Edg\/(\d+)/)
    return { name: 'Microsoft Edge', supported: version >= 79 }
  }

  if (isChrome) {
    const version = parseVersion(userAgent, /Chrome\/(\d+)/)
    return { name: 'Google Chrome', supported: version >= 56 }
  }

  if (isFirefox) {
    return { name: 'Firefox', supported: false }
  }

  if (isSafari) {
    return { name: 'Safari', supported: false }
  }

  return { name: 'Unbekannter Browser', supported: false }
}

export function checkBrowserSupport(): BrowserCheckResult {
  const hasBluetooth = 'bluetooth' in navigator
  const isSecureContext = window.isSecureContext
  const { name: browserName, supported: isSupportedBrowser } = detectBrowser()

  const issues: string[] = []

  if (!hasBluetooth) {
    issues.push('Web Bluetooth API ist in diesem Browser nicht verfügbar.')
  }

  if (!isSecureContext) {
    issues.push(
      'Die App muss über HTTPS (oder localhost) erreichbar sein — Web Bluetooth funktioniert nicht über unverschlüsseltes HTTP.',
    )
  }

  if (!isSupportedBrowser) {
    issues.push(
      `${browserName} wird nicht unterstützt. Bitte Chrome 56+, Edge 79+, Chrome für Android oder Bluefy (iOS) verwenden.`,
    )
  }

  return {
    hasBluetooth,
    isSecureContext,
    isSupportedBrowser,
    browserName,
    issues,
    isReady: hasBluetooth && isSecureContext && isSupportedBrowser,
  }
}
