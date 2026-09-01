import { AlertTriangle, Binoculars, Bug, CalendarClock, CloudRain, Droplets, Leaf, ShieldCheck } from 'lucide-react'

const levelClasses = {
  low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200',
}

const scoreItems = [
  ['Disease risk', 'disease', Leaf],
  ['Pest risk', 'pest', Bug],
  ['Weather risk', 'weather', CloudRain],
  ['Water stress', 'waterStress', Droplets],
]

const safeScore = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0))

export default function CropRiskPanel({ risk }) {
  if (!risk) return null
  const overall = safeScore(risk.scores?.overall ?? risk.score)
  const level = risk.level || (overall >= 80 ? 'critical' : overall >= 65 ? 'high' : overall >= 35 ? 'medium' : 'low')
  const forecast = Array.isArray(risk.forecastRisk) ? risk.forecastRisk.slice(0, 4) : []
  const scouting = risk.scouting

  return <div className="space-y-5" aria-live="polite">
    {risk.cached && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 flex gap-2"><AlertTriangle className="w-4 shrink-0 mt-0.5" /><span>Live weather is unavailable. Showing the last saved risk estimate from {risk.cacheAgeHours?.toFixed?.(1) || '?'} hours ago.</span></div>}

    <section className="rounded-2xl border border-[var(--border)] p-5 bg-[var(--surface)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">Farm health early warning</p><h2 className="text-2xl font-semibold mt-1">Overall crop-health risk</h2><p className="text-sm muted mt-1">Weather + crop + growth-stage context</p></div>
        <div className={`rounded-2xl px-5 py-3 text-center ${levelClasses[level] || levelClasses.medium}`}><p className="text-3xl font-bold">{overall}</p><p className="text-xs font-semibold uppercase">{level} risk</p></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {scoreItems.map(([label, key, Icon]) => <div key={key} className="rounded-xl bg-[var(--surface-muted)] p-3"><div className="flex items-center gap-2 text-xs muted"><Icon className="w-4" />{label}</div><p className="text-2xl font-semibold mt-2">{safeScore(risk.scores?.[key])}<span className="text-sm muted">/100</span></p></div>)}
      </div>
    </section>

    {forecast.length > 0 && <section className="rounded-2xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2"><CalendarClock className="w-5 text-[var(--primary)]" /><div><h3 className="font-semibold">24 / 48 / 72-hour risk forecast</h3><p className="text-xs muted">Forecasted crop-health conditions—not a disease occurrence prediction.</p></div></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">{forecast.map((item, index) => { const itemLevel = item.level || 'medium'; return <div key={`${item.date}-${item.offsetHours}`} className={`rounded-xl p-3 ${levelClasses[itemLevel] || levelClasses.medium}`}><p className="text-xs font-semibold">{index === 0 ? 'Today' : `+${item.offsetHours} hours`}</p><p className="text-2xl font-bold mt-1">{safeScore(item.score)}</p><p className="text-xs capitalize">{itemLevel}</p></div> })}</div>
    </section>}

    <div className="grid md:grid-cols-2 gap-5">
      <section className="rounded-2xl border border-[var(--border)] p-5"><h3 className="font-semibold">Why is the risk at this level?</h3><div className="mt-3 space-y-3">{(risk.factors || []).slice(0, 5).map((factor) => <div key={factor.key}><div className="flex justify-between gap-3 text-sm"><span>{factor.label}</span><span className="font-semibold">+{safeScore(factor.impact)}</span></div><div className="h-1.5 bg-[var(--surface-muted)] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[var(--primary)]" style={{ width: `${safeScore(factor.impact)}%` }} /></div><p className="text-xs muted mt-1">{factor.detail}</p></div>)}</div></section>
      {scouting && <section className="rounded-2xl border border-[var(--border)] p-5"><div className="flex gap-2"><Binoculars className="w-5 text-[var(--primary)] shrink-0" /><div><p className="text-xs font-semibold uppercase text-[var(--primary)]">Scouting mission</p><h3 className="font-semibold">{scouting.headline}</h3></div></div><p className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm font-medium">Scout {scouting.urgency}.</p><h4 className="font-semibold text-sm mt-4">Inspect</h4><ul className="list-disc pl-5 mt-2 text-sm space-y-1">{(scouting.inspect || []).map((item) => <li key={item}>{item}</li>)}</ul><h4 className="font-semibold text-sm mt-4">Record</h4><ul className="list-disc pl-5 mt-2 text-sm space-y-1">{(scouting.questions || []).map((item) => <li key={item}>{item}</li>)}</ul></section>}
    </div>
    <p className="flex gap-2 text-xs muted"><ShieldCheck className="w-4 shrink-0" />{risk.disclaimer || 'This risk estimate supports scouting decisions and does not confirm disease, pest infestation, or treatment need.'}</p>
  </div>
}
