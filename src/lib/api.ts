/** Railway Production-Backend (Fallback wenn VITE_API_BASE_URL fehlt). */
export const DEFAULT_PRODUCTION_API_BASE =
  'https://scooter-unlock-backend-production.up.railway.app'

/**
 * API-Basis-URL für Backend-Aufrufe.
 * Dev: leer = relativer Pfad `/api/...` → Vite-Proxy → localhost:3001
 * Prod: VITE_API_BASE_URL oder DEFAULT_PRODUCTION_API_BASE
 */
export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '')

  if (import.meta.env.DEV) {
    if (configured?.startsWith('https://')) {
      return configured
    }
    return ''
  }

  return configured || DEFAULT_PRODUCTION_API_BASE
}
