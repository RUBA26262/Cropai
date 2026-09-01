import { useEffect, useState } from 'react'
import { alertApi } from '../../services/api'
import AlertCard from '../../components/AlertCard'
import { BellOff } from 'lucide-react'
import { friendlyFirebaseError } from '../../services/api'

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => { setLoading(true); setError(''); return alertApi.list().then((res) => setAlerts(res.data)).catch((reason) => setError(friendlyFirebaseError(reason, 'Alerts could not be loaded.'))).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])

  const handleMarkRead = async (id) => {
    await alertApi.markRead(id)
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)))
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-display font-semibold">Alerts</h1>
      <p className="muted text-sm mt-1">Disease, pest, weather-risk and expert-review notifications.</p>

      {error && <div className="error-box mt-5 flex justify-between gap-3"><span>{error}</span><button className="font-semibold underline" onClick={load}>Retry</button></div>}
      {loading && <p className="surface p-6 mt-6 text-center muted">Loading…</p>}
      {!loading && alerts.length === 0 && !error && (
        <div className="mt-10 text-center muted">
          <BellOff className="w-8 h-8 mx-auto" />
          <p className="mt-2 text-sm">No alerts yet.</p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} onMarkRead={handleMarkRead} />
        ))}
      </div>
    </div>
  )
}
