import { Battery, Cpu, Radio, Zap } from 'lucide-react'
import { SCOOTER_MODELS } from '../lib/ble/constants.ts'
import { useBluetooth } from '../hooks/useBluetooth.ts'

function detectModel(deviceName: string | undefined): string {
  if (!deviceName) {
    return 'Unbekanntes Modell'
  }

  for (const [prefix, model] of Object.entries(SCOOTER_MODELS)) {
    if (deviceName.startsWith(prefix)) {
      return model
    }
  }

  return deviceName
}

interface ScooterStatusProps {
  batteryPercent?: number | null
}

export function ScooterStatus({ batteryPercent = null }: ScooterStatusProps) {
  const { status, device, deviceInfo } = useBluetooth()
  const visible = status === 'connected' && deviceInfo !== null

  if (!visible || !deviceInfo) {
    return null
  }

  const model = detectModel(device?.name)
  const battery = batteryPercent ?? null
  const batteryWidth =
    battery !== null ? `${Math.min(100, Math.max(0, battery))}%` : '0%'

  return (
    <section
      className="animate-fade-in rounded-xl border border-border bg-surface p-5 transition-all duration-500"
      aria-live="polite"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Scooter</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{model}</h2>
        </div>
        <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-1 font-mono-tech text-xs text-accent">
          ONLINE
        </span>
      </div>

      <dl className="space-y-4">
        <div>
          <dt className="text-xs text-muted">Seriennummer</dt>
          <dd className="mt-1 font-mono-tech text-sm text-foreground">
            {deviceInfo.serial || '—'}
          </dd>
        </div>

        <div>
          <dt className="mb-2 flex items-center gap-2 text-xs text-muted">
            <Battery className="h-3.5 w-3.5" aria-hidden />
            Akkustand
          </dt>
          <dd>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700"
                  style={{ width: batteryWidth }}
                />
              </div>
              <span className="font-mono-tech text-sm text-accent">
                {battery !== null ? `${battery}%` : '—'}
              </span>
            </div>
          </dd>
        </div>

        <div>
          <dt className="mb-2 text-xs text-muted">Firmware</dt>
          <dd className="grid gap-2 sm:grid-cols-3">
            <FirmwareBadge icon={Zap} label="DRV" version={deviceInfo.firmwareDrv} />
            <FirmwareBadge icon={Radio} label="BLE" version={deviceInfo.firmwareBle} />
            <FirmwareBadge icon={Cpu} label="BMS" version={deviceInfo.firmwareBms} />
          </dd>
        </div>
      </dl>
    </section>
  )
}

function FirmwareBadge({
  icon: Icon,
  label,
  version,
}: {
  icon: typeof Zap
  label: string
  version: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2 transition-colors duration-300 hover:border-accent/30">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="h-3 w-3 text-accent" aria-hidden />
        {label}
      </div>
      <p className="mt-1 font-mono-tech text-sm text-foreground">{version}</p>
    </div>
  )
}
