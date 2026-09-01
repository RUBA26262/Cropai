import { useEffect, useMemo, useState } from 'react'
import { conditionApi, friendlyFirebaseError, predictionApi, scanApi } from '../../services/api'
import { useI18n } from '../../context/I18nContext'
import SeverityBadge from '../../components/SeverityBadge'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, ReferenceArea, ReferenceLine,
} from 'recharts'

const SEVERITY_COLORS = { none: '#3f6f4c', low: '#8fb599', medium: '#c96f3e', high: '#dc2626', unknown: '#9ca3af' }
const SEVERITY_SCORE = { none: 0, low: 25, medium: 60, high: 90, unknown: 40 }

export default function History() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [guidance, setGuidance] = useState(null)
  const [error, setError] = useState('')
  const { locale, t } = useI18n()
  const openResult = async (prediction) => {
    setSelected(prediction); setGuidance(null)
    if (prediction.result?.conditionId && !prediction.result?.preliminary) setGuidance((await conditionApi.get(prediction.result.conditionId)).data)
  }

  useEffect(() => {
    let active = true
    predictionApi.list().then((res) => { if (active) setPredictions(res.data) }).catch((reason) => { if (active) setError(friendlyFirebaseError(reason, t('historyLoadError'))) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [t])

  const filtered = useMemo(
    () => (severityFilter === 'all' ? predictions : predictions.filter((p) => p.severity === severityFilter)),
    [predictions, severityFilter]
  )

  const trendData = useMemo(() => {
    const byDate = {}
    predictions.forEach((p) => {
      const timestamp = new Date(p.created_at)
      const key = timestamp.toISOString().slice(0, 10)
      byDate[key] = byDate[key] || { key, date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), scans: 0, riskTotal: 0 }
      byDate[key].scans += 1
      byDate[key].riskTotal += SEVERITY_SCORE[p.severity] ?? 40
    })
    return Object.values(byDate).sort((a, b) => a.key.localeCompare(b.key)).map((item) => ({ ...item, pressure: Math.round(item.riskTotal / item.scans) }))
  }, [predictions])

  const diseaseFrequency = useMemo(() => {
    const counts = {}
    predictions.forEach((p) => {
      if (p.severity === 'none') return
      const name = p.disease_name || 'Unknown'
      counts[name] = (counts[name] || 0) + 1
    })
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [predictions])

  const severityBreakdown = useMemo(() => {
    const counts = { none: 0, low: 0, medium: 0, high: 0 }
    predictions.forEach((p) => { counts[p.severity] = (counts[p.severity] || 0) + 1 })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([severity, value]) => ({ name: severity === 'none' ? 'Healthy' : severity, value, severity }))
  }, [predictions])

  const summary = useMemo(() => {
    const healthy = predictions.filter((item) => item.severity === 'none').length
    const urgent = predictions.filter((item) => item.severity === 'high').length
    const latest = trendData.at(-1)?.pressure ?? 0
    return {
      healthyRate: predictions.length ? Math.round((healthy / predictions.length) * 100) : 0,
      urgent,
      latest,
      latestLabel: latest >= 70 ? 'Act now' : latest >= 40 ? 'Watch closely' : 'Low pressure',
    }
  }, [predictions, trendData])

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-semibold">{t('historyTitle')}</h1>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="field !w-auto">
          <option value="all">{t('allSeverities')}</option><option value="none">{t('healthy')}</option><option value="low">{t('low')}</option><option value="medium">{t('medium')}</option><option value="high">{t('high')}</option>
        </select>
      </div>

      {error && <p className="error-box mt-5">{error}</p>}
      {loading && <p className="surface p-8 mt-6 text-center muted">{t('loading')}</p>}

      {!loading && predictions.length === 0 && <div className="surface p-8 mt-6 text-center"><p className="font-semibold">No recorded scans yet</p><p className="muted text-sm mt-2">Complete a scan or preliminary assessment and it will appear here.</p></div>}

      {predictions.length > 0 && (
        <div className="mt-6">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="surface p-4"><p className="text-xs muted uppercase tracking-wide">Healthy scans</p><p className="text-3xl font-semibold mt-1 text-emerald-700 dark:text-emerald-300">{summary.healthyRate}%</p><p className="text-xs muted mt-1">Share of all recorded scans</p></div>
            <div className="surface p-4"><p className="text-xs muted uppercase tracking-wide">Latest field pressure</p><p className={`text-3xl font-semibold mt-1 ${summary.latest >= 70 ? 'text-red-700 dark:text-red-300' : summary.latest >= 40 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{summary.latest}/100</p><p className="text-xs muted mt-1">{summary.latestLabel}</p></div>
            <div className="surface p-4"><p className="text-xs muted uppercase tracking-wide">Urgent results</p><p className="text-3xl font-semibold mt-1">{summary.urgent}</p><p className="text-xs muted mt-1">High-severity scans needing action</p></div>
          </div>

          <div className="surface p-5 mt-6">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-display font-semibold">Field attention trend</h2><p className="text-sm muted mt-1">Daily severity pressure turns scan history into an easy action signal.</p></div><div className="flex gap-3 text-xs"><span className="text-emerald-700">0–39 Low</span><span className="text-amber-700">40–69 Watch</span><span className="text-red-700">70–100 Act</span></div></div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData} margin={{ top: 15, right: 18, bottom: 5, left: 0 }}>
                <defs><linearGradient id="pressureFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c96f3e" stopOpacity={0.45} /><stop offset="95%" stopColor="#c96f3e" stopOpacity={0.04} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 12 }} />
                <ReferenceArea y1={0} y2={40} fill="#22c55e" fillOpacity={0.07} />
                <ReferenceArea y1={40} y2={70} fill="#f59e0b" fillOpacity={0.08} />
                <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.07} />
                <ReferenceLine y={70} stroke="#b91c1c" strokeDasharray="4 4" label={{ value: 'Action line', position: 'insideTopRight', fill: '#b91c1c', fontSize: 11 }} />
                <Tooltip formatter={(value, name, item) => [`${value}/100 from ${item.payload.scans} scan${item.payload.scans === 1 ? '' : 's'}`, 'Attention pressure']} />
                <Area type="monotone" dataKey="pressure" stroke="#b45309" strokeWidth={3} fill="url(#pressureFill)" activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs muted">Pressure is a simple daily index derived from recorded severity: healthy 0, low 25, medium 60 and high 90. It is a monitoring aid, not a disease probability.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="surface p-5">
              <h2 className="font-display font-semibold">Most frequent conditions</h2><p className="text-sm muted mt-1">Shows where field attention is accumulating.</p>
              <ResponsiveContainer width="100%" height={260}>
              <BarChart data={diseaseFrequency} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} scan${value === 1 ? '' : 's'}`, 'Observed']} />
                <Bar dataKey="count" fill="#2f5a3b" radius={[0, 4, 4, 0]} />
              </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="surface p-5">
              <h2 className="font-display font-semibold">Severity mix</h2><p className="text-sm muted mt-1">A quick view of healthy, watch and urgent results.</p>
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={severityBreakdown} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={58} outerRadius={88} paddingAngle={3}>
                      {severityBreakdown.map((entry) => <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity]} />)}
                    </Pie>
                    <Legend verticalAlign="bottom" />
                    <Tooltip formatter={(value) => [`${value} scan${value === 1 ? '' : 's'}`, 'Count']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-x-0 top-[88px] text-center pointer-events-none"><p className="text-3xl font-semibold">{predictions.length}</p><p className="text-xs muted">total scans</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="surface mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--muted)] text-left">
              <tr>
                <th className="px-5 py-3 font-medium">{t('date')}</th><th className="px-5 py-3 font-medium">{t('disease')}</th><th className="px-5 py-3 font-medium">{t('confidence')}</th><th className="px-5 py-3 font-medium">{t('severity')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-[var(--surface-muted)]" onClick={() => openResult(p)}>
                  <td className="px-5 py-3 muted">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 font-medium">
                    {p.disease_name} {p.is_mock && <span className="text-xs text-clay-600 font-normal">(demo)</span>}
                  </td>
                  <td className="px-5 py-3 muted">{(Number(p.confidence) || 0).toFixed(1)}%</td>
                  <td className="px-5 py-3"><SeverityBadge severity={p.severity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <div className="fixed inset-0 z-50 bg-black/60 p-4 grid place-items-center" role="dialog" aria-modal="true" onClick={() => setSelected(null)}><article className="surface p-6 max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(event) => event.stopPropagation()}><div className="flex justify-between gap-3"><div><p className="text-sm muted">{selected.result?.preliminary ? 'Preliminary assessment' : 'Scan result'}</p><h2 className="text-2xl font-semibold">{selected.result?.uncertain ? t('unableDiagnose') : selected.disease_name}</h2></div><button className="secondary-button" onClick={() => setSelected(null)}>Close</button></div><div className="grid sm:grid-cols-3 gap-3 mt-5 text-sm"><div><p className="muted">Status</p><p className="capitalize">{selected.status}</p></div><div><p className="muted">Confidence</p><p>{selected.result ? `${(Number(selected.confidence) || 0).toFixed(1)}%` : 'Pending'}</p></div><div><p className="muted">Severity</p><p className="capitalize">{selected.result?.severity || 'Not estimated'}</p></div></div>{selected.result?.preliminary && selected.result?.actions?.length > 0 && <div className="mt-5"><h3 className="font-semibold">Recommended next steps</h3><ul className="list-disc pl-5 text-sm mt-2 space-y-1">{selected.result.actions.map((item) => <li key={item}>{item}</li>)}</ul><p className="text-sm text-red-700 mt-4">This was saved after online analysis was unavailable. Confirm with an agricultural expert before applying chemicals.</p></div>}{selected.result?.alternatives?.length > 0 && <div className="mt-5"><h3 className="font-semibold">Model alternatives</h3><ul className="text-sm muted mt-2 space-y-1">{selected.result.alternatives.map((item) => <li key={item.conditionId}>{item.conditionId}: {((Number(item.confidence) || 0) * 100).toFixed(1)}%</li>)}</ul></div>}{guidance && <div className="mt-5 space-y-4"><div><h3 className="font-semibold">Symptoms</h3><ul className="list-disc pl-5 text-sm mt-1">{(guidance.symptoms?.[locale] || guidance.symptoms?.en || []).map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3 className="font-semibold">Integrated management</h3><ul className="list-disc pl-5 text-sm mt-1">{(guidance.ipm?.[locale] || guidance.ipm?.en || []).map((item) => <li key={item}>{item}</li>)}</ul></div><p className="text-sm text-red-600">{guidance.escalation?.[locale] || guidance.escalation?.en}</p></div>}{(selected.result?.uncertain || selected.status === 'needs_expert') && <button className="primary-button mt-5" onClick={() => scanApi.requestReview(selected.id).then(() => setSelected({ ...selected, expertReviewStatus: 'assigned' }))} disabled={selected.expertReviewStatus === 'assigned'}>{selected.expertReviewStatus === 'assigned' ? 'Expert assigned' : t('expertReview')}</button>}<p className="text-xs muted mt-5">Model version: {selected.result?.modelVersion || 'No validated inference'} · Heatmap/attention is explanatory evidence, not proof.</p></article></div>}
    </div>
  )
}
