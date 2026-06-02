const DISMISS_STORAGE_KEY = 'scooter-unlock-ios-bluefy-banner-dismissed'

export function isIosOrSafari(userAgent = navigator.userAgent): boolean {
  const isIos = /iPhone|iPad|iPod/i.test(userAgent)
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
  return isIos || isSafari
}

export function isIosBluefyBannerDismissed(): boolean {
  return localStorage.getItem(DISMISS_STORAGE_KEY) === '1'
}

export function dismissIosBluefyBanner(): void {
  localStorage.setItem(DISMISS_STORAGE_KEY, '1')
}

export const BLUEFY_APP_STORE_URL =
  'https://apps.apple.com/app/bluefy-web-ble-browser/id1492697205'
