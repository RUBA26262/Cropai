import { Bell, AlertTriangle, CloudRain, CalendarClock, CheckCircle2 } from 'lucide-react'

const ICONS = {
  disease_detected: AlertTriangle,
  weather_risk: CloudRain,
  monitoring_reminder: CalendarClock,
  expert_review: CheckCircle2,
}

export default function AlertCard({ alert, onMarkRead, markReadLabel = 'Mark read' }) {
  const Icon = ICONS[alert.type] || Bell
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] ${alert.is_read ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'}`}>
      <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[var(--primary)]" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{alert.title}</p><p className="text-sm muted mt-0.5">{alert.message}</p><p className="text-xs muted mt-1">{new Date(alert.created_at).toLocaleString()}</p>
      </div>
      {!alert.is_read && (
        <button onClick={() => onMarkRead(alert.id)} className="link text-xs shrink-0">
          {markReadLabel}
        </button>
      )}
    </div>
  )
}
