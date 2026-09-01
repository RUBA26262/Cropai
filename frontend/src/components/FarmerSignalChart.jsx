import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function SignalTooltip({ active, payload }) {
  if (!active || !payload?.[0]?.payload) return null
  const item = payload[0].payload
  const meaning = item.value >= 70 ? 'High attention signal' : item.value >= 40 ? 'Watch closely' : 'Lower signal'
  return <div className="surface !rounded-lg px-3 py-2 text-sm">
    <p className="font-semibold">{item.label}</p>
    <p className="muted">{item.value}/100 · {meaning}</p>
  </div>
}

export default function FarmerSignalChart({ indicators }) {
  const strongest = [...indicators].sort((a, b) => b.value - a.value)[0]
  const summary = strongest?.value >= 70
    ? `${strongest.label} is the strongest signal and needs prompt attention.`
    : strongest?.value >= 40
      ? `${strongest.label} is the main signal to monitor.`
      : 'No single symptom signal is dominant from the information entered.'

  return <div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Farmer-friendly signal analysis</h3>
        <p className="text-sm muted mt-1">Compare possible causes against clear action zones.</p>
      </div>
      <div className="flex gap-3 text-xs" aria-label="Graph risk zones">
        <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />Low</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1" />Watch</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />Act</span>
      </div>
    </div>

    <div className="mt-3" role="img" aria-label={`Symptom indicator graph. ${summary}`}>
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={indicators} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 11 }} unit="%" />
          <YAxis type="category" dataKey="label" width={142} tick={{ fontSize: 12, fill: 'var(--text)' }} />
          <ReferenceArea x1={0} x2={40} fill="#22c55e" fillOpacity={0.08} />
          <ReferenceArea x1={40} x2={70} fill="#f59e0b" fillOpacity={0.10} />
          <ReferenceArea x1={70} x2={100} fill="#ef4444" fillOpacity={0.08} />
          <ReferenceLine x={70} stroke="#b91c1c" strokeDasharray="4 4" label={{ value: 'Act', position: 'insideTopRight', fontSize: 11, fill: '#b91c1c' }} />
          <Tooltip content={<SignalTooltip />} cursor={{ fill: 'var(--surface-muted)', opacity: 0.45 }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
            {indicators.map((indicator) => <Cell key={indicator.label} fill={indicator.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm">
      <strong>What this graph means:</strong> {summary}
      <p className="text-xs muted mt-1">These are symptom-comparison scores, not confirmed disease probabilities. Image-model or expert confirmation is still required.</p>
    </div>
  </div>
}
