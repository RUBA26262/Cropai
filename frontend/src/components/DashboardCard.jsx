export default function DashboardCard({ label, value, sublabel, accent = 'forest' }) {
  const accents = {
    forest: 'border-l-forest-500',
    clay: 'border-l-clay-500',
    gray: 'border-l-gray-300',
  }
  return (
    <div className={`surface !rounded-2xl border-l-4 ${accents[accent]} p-5`}>
      <p className="text-sm muted">{label}</p>
      <p className="text-3xl font-display font-semibold mt-1">{value}</p>
      {sublabel && <p className="text-xs muted mt-1">{sublabel}</p>}
    </div>
  )
}
