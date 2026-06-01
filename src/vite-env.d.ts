/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ADMIN_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
