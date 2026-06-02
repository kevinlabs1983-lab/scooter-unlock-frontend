export type PackageId = 1 | 2 | 3 | 4

export interface PackageInfo {
  packageId: PackageId
  name: string
  models: string
  originalPrice: number
  salePrice: number
  currency: 'eur'
  maxSpeed: number
  originalPriceFormatted: string
  salePriceFormatted: string
  savingsPercent: number
}

export interface CheckoutCreateResponse {
  checkoutUrl: string
  package: PackageInfo
}

import { getApiBase } from './api.ts'

export { getApiBase } from './api.ts'

export async function createCheckoutSession(
  packageId: PackageId,
  options?: { customerEmail?: string; legalConsentAccepted?: boolean },
): Promise<CheckoutCreateResponse> {
  const response = await fetch(`${getApiBase()}/api/checkout/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageId,
      customerEmail: options?.customerEmail,
      legalConsentAccepted: options?.legalConsentAccepted === true,
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    checkoutUrl?: string
    package?: PackageInfo
  }

  if (!response.ok) {
    throw new Error(payload.error ?? `Checkout fehlgeschlagen (${response.status})`)
  }

  if (!payload.checkoutUrl) {
    throw new Error('Keine Checkout-URL vom Server erhalten')
  }

  return payload as CheckoutCreateResponse
}
