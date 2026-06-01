import { getApiBase } from './checkout.ts'
import type { PackageId } from './checkout.ts'

const SESSION_KEY = 'ninebot-admin-authenticated'

export interface AdminStats {
  totalSales: number
  activeLicenses: number
  activatedToday: number
  totalRevenueCents: number
  totalRevenueFormatted: string
}

export interface AdminLicense {
  id: string
  key: string
  packageId: PackageId | null
  packageName: string
  status: string
  email: string | null
  scooterSerial: string | null
  activatedAt: string | null
  createdAt: string
  activationCount: number
}

export interface AdminLicenseList {
  items: AdminLicense[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** Geheimer Admin-Token aus Vite-Env (muss mit backend ADMIN_SECRET übereinstimmen). */
export function getAdminSecretFromEnv(): string {
  return import.meta.env.VITE_ADMIN_SECRET?.trim() ?? ''
}

export function isAdminSessionActive(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1' && Boolean(getAdminSecretFromEnv())
}

export function saveAdminSession(): void {
  sessionStorage.setItem(SESSION_KEY, '1')
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function verifyAdminPassword(password: string): boolean {
  const expected = getAdminSecretFromEnv()
  if (!expected) {
    return false
  }
  return password.trim() === expected
}

function buildAdminHeaders(init?: RequestInit): Headers {
  const adminSecret = getAdminSecretFromEnv()

  if (!isAdminSessionActive() || !adminSecret) {
    throw new Error('Nicht angemeldet oder VITE_ADMIN_SECRET fehlt')
  }

  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${adminSecret}`)

  return headers
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: buildAdminHeaders(init),
  })

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        payload.error ??
          'Forbidden — ADMIN_SECRET im Backend muss exakt VITE_ADMIN_SECRET entsprechen (Backend neu starten).',
      )
    }
    throw new Error(payload.error ?? `Anfrage fehlgeschlagen (${response.status})`)
  }

  return payload as T
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return adminFetch<AdminStats>('/api/admin/stats')
}

export async function fetchAdminLicenses(params: {
  search?: string
  status?: string
  packageId?: PackageId | ''
  page?: number
  limit?: number
}): Promise<AdminLicenseList> {
  const query = new URLSearchParams()

  if (params.search?.trim()) {
    query.set('search', params.search.trim())
  }

  if (params.status && params.status !== 'all') {
    query.set('status', params.status)
  }

  if (params.packageId) {
    query.set('packageId', String(params.packageId))
  }

  query.set('page', String(params.page ?? 1))
  query.set('limit', String(params.limit ?? 20))

  return adminFetch<AdminLicenseList>(`/api/admin/licenses?${query.toString()}`)
}

export async function createAdminLicense(
  packageId: PackageId,
  email: string,
): Promise<{ key: string }> {
  return adminFetch<{ key: string }>('/api/admin/licenses/create', {
    method: 'POST',
    body: JSON.stringify({ packageId, email }),
  })
}

export async function revokeAdminLicense(id: string): Promise<void> {
  await adminFetch<{ success: boolean; status: string }>(`/api/admin/licenses/${id}/revoke`, {
    method: 'POST',
  })
}

export async function restoreAdminLicense(id: string): Promise<void> {
  await adminFetch<{ success: boolean }>(`/api/admin/licenses/${id}/restore`, {
    method: 'POST',
  })
}
