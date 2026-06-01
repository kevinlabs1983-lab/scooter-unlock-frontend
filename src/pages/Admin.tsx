import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut, Plus, Download } from 'lucide-react'
import {
  clearAdminSession,
  createAdminLicense,
  fetchAdminLicenses,
  fetchAdminStats,
  getAdminSecretFromEnv,
  isAdminSessionActive,
  restoreAdminLicense,
  revokeAdminLicense,
  saveAdminSession,
  verifyAdminPassword,
  type AdminLicense,
  type AdminStats,
} from '../lib/admin-api.ts'
import type { PackageId } from '../lib/checkout.ts'

type StatusFilter = 'all' | 'inactive' | 'active' | 'revoked'

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'border-green-500/40 bg-green-500/15 text-green-400'
    case 'revoked':
      return 'border-red-500/40 bg-red-500/15 text-red-400'
    default:
      return 'border-border bg-surface text-muted'
  }
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString('de-DE')
}

function licensesToCsv(items: AdminLicense[]): string {
  const header = [
    'Key',
    'Paket',
    'Status',
    'E-Mail',
    'Scooter-Serial',
    'Aktiviert am',
    'Erstellt am',
    'Aktivierungen',
  ]

  const rows = items.map((row) => [
    row.key,
    row.packageName,
    row.status,
    row.email ?? '',
    row.scooterSerial ?? '',
    row.activatedAt ?? '',
    row.createdAt,
    String(row.activationCount),
  ])

  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`

  return [header, ...rows].map((line) => line.map(escape).join(';')).join('\n')
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(() => isAdminSessionActive())
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [licenses, setLicenses] = useState<AdminLicense[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [packageFilter, setPackageFilter] = useState<PackageId | ''>('')

  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPackageId, setModalPackageId] = useState<PackageId>(1)
  const [modalEmail, setModalEmail] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    variant: 'danger' | 'success'
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setActionError(null)

    try {
      const [statsData, listData] = await Promise.all([
        fetchAdminStats(),
        fetchAdminLicenses({
          search,
          status: statusFilter,
          packageId: packageFilter,
          page,
          limit: 20,
        }),
      ])

      setStats(statsData)
      setLicenses(listData.items)
      setTotal(listData.total)
      setTotalPages(listData.totalPages)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, packageFilter, page])

  useEffect(() => {
    if (authenticated) {
      void loadData()
    }
  }, [authenticated, loadData])

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault()
    setLoginError(null)

    if (!getAdminSecretFromEnv()) {
      setLoginError('VITE_ADMIN_SECRET ist nicht konfiguriert.')
      return
    }

    if (!verifyAdminPassword(password)) {
      setLoginError('Ungültiges Passwort.')
      return
    }

    saveAdminSession()
    setAuthenticated(true)
    setPassword('')
  }

  const handleLogout = () => {
    clearAdminSession()
    setAuthenticated(false)
  }

  const openRevokeDialog = (license: AdminLicense) => {
    setConfirmDialog({
      title: 'Lizenz deaktivieren',
      message:
        'Bist du sicher? Der Kunde wird per E-Mail informiert, dass sein Lizenzschlüssel deaktiviert wurde.',
      confirmLabel: 'Ja, deaktivieren',
      variant: 'danger',
      onConfirm: async () => {
        await revokeAdminLicense(license.id)
        await loadData()
      },
    })
  }

  const openRestoreDialog = (license: AdminLicense) => {
    setConfirmDialog({
      title: 'Lizenz reaktivieren',
      message: 'Key reaktivieren? Der Kunde wird per E-Mail informiert.',
      confirmLabel: 'Ja, reaktivieren',
      variant: 'success',
      onConfirm: async () => {
        await restoreAdminLicense(license.id)
        await loadData()
      },
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmDialog) {
      return
    }

    setConfirmLoading(true)
    setActionError(null)

    try {
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen')
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleCreateLicense = async (event: React.FormEvent) => {
    event.preventDefault()
    setModalLoading(true)
    setCreatedKey(null)

    try {
      const { key } = await createAdminLicense(modalPackageId, modalEmail.trim())
      setCreatedKey(key)
      setModalEmail('')
      await loadData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Erstellung fehlgeschlagen')
    } finally {
      setModalLoading(false)
    }
  }

  const handleCsvExport = async () => {
    try {
      const all: AdminLicense[] = []
      let currentPage = 1
      let pages = 1

      do {
        const batch = await fetchAdminLicenses({
          search,
          status: statusFilter,
          packageId: packageFilter,
          page: currentPage,
          limit: 100,
        })
        all.push(...batch.items)
        pages = batch.totalPages
        currentPage += 1
      } while (currentPage <= pages)

      const blob = new Blob([licensesToCsv(all)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `licenses-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'CSV-Export fehlgeschlagen')
    }
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-4 py-16">
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-border bg-surface-elevated p-8"
        >
          <h1 className="text-xl font-semibold text-foreground">Admin Login</h1>
          <p className="mt-2 text-sm text-muted">Zugang nur für autorisierte Nutzer.</p>

          <label className="mt-6 block">
            <span className="text-xs uppercase tracking-wider text-muted">Passwort</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent/50"
              autoComplete="current-password"
            />
          </label>

          {loginError && (
            <p className="mt-3 text-sm text-red-400">{loginError}</p>
          )}

          <button
            type="submit"
            className="mt-6 w-full rounded-xl border border-accent/50 bg-accent/10 py-3 text-sm font-semibold text-accent hover:bg-accent/20"
          >
            Anmelden
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Lizenzen & Verkäufe verwalten</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setModalOpen(true)
              setCreatedKey(null)
            }}
            className="flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Key manuell erstellen
          </button>
          <button
            type="button"
            onClick={() => void handleCsvExport()}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:border-accent/40"
          >
            <Download className="h-4 w-4" aria-hidden />
            CSV Export
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Abmelden
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gesamte Verkäufe" value={String(stats?.totalSales ?? '—')} />
        <StatCard label="Aktive Lizenzen" value={String(stats?.activeLicenses ?? '—')} />
        <StatCard label="Heute aktiviert" value={String(stats?.activatedToday ?? '—')} />
        <StatCard label="Umsatz gesamt" value={stats?.totalRevenueFormatted ?? '—'} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Suche Key, E-Mail, Serial…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent/50"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as StatusFilter)
            setPage(1)
          }}
          className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm outline-none"
        >
          <option value="all">Alle Status</option>
          <option value="inactive">inactive</option>
          <option value="active">active</option>
          <option value="revoked">revoked</option>
        </select>
        <select
          value={packageFilter}
          onChange={(event) => {
            setPackageFilter(
              event.target.value ? (Number(event.target.value) as PackageId) : '',
            )
            setPage(1)
          }}
          className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm outline-none"
        >
          <option value="">Alle Pakete</option>
          <option value="1">Paket 1 — G30D/G2D/F2</option>
          <option value="2">Paket 2 — F3</option>
          <option value="3">Paket 3 — G3</option>
          <option value="4">Paket 4 — ZT3/GT3</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Laden…
          </div>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">E-Mail</th>
                <th className="px-4 py-3">Scooter-Serial</th>
                <th className="px-4 py-3">Aktiviert am</th>
                <th className="px-4 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-mono-tech text-xs text-accent">{license.key}</td>
                  <td className="px-4 py-3 text-xs text-muted">{license.packageName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                        statusBadgeClass(license.status),
                      ].join(' ')}
                    >
                      {license.status === 'revoked' ? 'REVOKED' : license.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{license.email ?? '—'}</td>
                  <td className="px-4 py-3 font-mono-tech text-xs">
                    {license.scooterSerial ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {formatDate(license.activatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {(license.status === 'active' || license.status === 'inactive') && (
                      <button
                        type="button"
                        onClick={() => openRevokeDialog(license)}
                        className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Revoke
                      </button>
                    )}
                    {license.status === 'revoked' && (
                      <button
                        type="button"
                        onClick={() => openRestoreDialog(license)}
                        className="rounded border border-green-500/40 px-2 py-1 text-xs text-green-400 hover:bg-green-500/10"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!licenses.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    Keine Lizenzen gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {total} Einträge · Seite {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
          >
            Zurück
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
          >
            Weiter
          </button>
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-foreground">
              {confirmDialog.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{confirmDialog.message}</p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => setConfirmDialog(null)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => void handleConfirmAction()}
                className={[
                  'flex-1 rounded-lg border py-2 text-sm font-semibold disabled:opacity-50',
                  confirmDialog.variant === 'danger'
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-green-500/50 bg-green-500/10 text-green-400',
                ].join(' ')}
              >
                {confirmLoading ? 'Bitte warten…' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-6">
            <h2 className="text-lg font-semibold text-foreground">Key manuell erstellen</h2>

            <form onSubmit={(event) => void handleCreateLicense(event)} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs uppercase text-muted">Paket</span>
                <select
                  value={modalPackageId}
                  onChange={(event) =>
                    setModalPackageId(Number(event.target.value) as PackageId)
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value={1}>Paket 1 — G30D/G2D/F2</option>
                  <option value={2}>Paket 2 — F3</option>
                  <option value={3}>Paket 3 — G3</option>
                  <option value={4}>Paket 4 — ZT3/GT3</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase text-muted">E-Mail</span>
                <input
                  type="email"
                  required
                  value={modalEmail}
                  onChange={(event) => setModalEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>

              {createdKey && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-center">
                  <p className="text-xs text-muted">Generierter Key</p>
                  <p className="mt-1 font-mono-tech text-sm font-bold text-accent">{createdKey}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm text-muted"
                >
                  Schließen
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 rounded-lg border border-accent/50 bg-accent/10 py-2 text-sm font-semibold text-accent disabled:opacity-50"
                >
                  {modalLoading ? 'Erstelle…' : 'Erstellen & E-Mail senden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}
