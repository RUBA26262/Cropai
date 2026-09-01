export default function ConfidenceMeter({ confidence }) {
  const numericConfidence = Number(confidence)
  const pct = Math.max(0, Math.min(100, Number.isFinite(numericConfidence) ? numericConfidence : 0))
  const color = pct >= 85 ? '#2f5a3b' : pct >= 65 ? '#c96f3e' : '#b45309'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-forest-600">Model confidence</span>
        <span className="text-sm font-semibold">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2.5 bg-forest-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {pct < 65 && (
        <p className="text-xs text-clay-600 mt-1.5">
          AI confidence is low. Consider uploading another image or requesting expert review.
        </p>
      )}
    </div>
  )
}
