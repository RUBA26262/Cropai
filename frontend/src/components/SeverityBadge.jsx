const STYLES = {
  none: 'bg-forest-100 text-forest-700',
  low: 'bg-forest-100 text-forest-700',
  medium: 'bg-clay-100 text-clay-700 bg-[#faeada] text-[#ad5830]',
  high: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-600',
}

export default function SeverityBadge({ severity }) {
  const key = (severity || 'unknown').toLowerCase()
  const label = key === 'none' ? 'Healthy' : key.charAt(0).toUpperCase() + key.slice(1)
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[key] || STYLES.unknown}`}>
      {label}
    </span>
  )
}
