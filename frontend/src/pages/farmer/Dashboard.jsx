import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sprout, ScanLine, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { farmApi, farmCropApi, predictionApi, weatherApi } from '../../services/api'
import DashboardCard from '../../components/DashboardCard'
import SeverityBadge from '../../components/SeverityBadge'
import { useI18n } from '../../context/I18nContext'
import { friendlyFirebaseError } from '../../services/api'
import CropRiskPanel from '../../components/CropRiskPanel'

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [farms, setFarms] = useState([])
  const [predictions, setPredictions] = useState([])
  const [farmCrops, setFarmCrops] = useState([])
  const [selectedFarmCrop, setSelectedFarmCrop] = useState('')
  const [risk, setRisk] = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.allSettled([farmApi.list(), predictionApi.list()]).then(async ([farmsResult, scansResult]) => {
      if (!active) return
      if (farmsResult.status === 'fulfilled') {
        const loadedFarms = farmsResult.value.data
        setFarms(loadedFarms)
        const cropResults = await Promise.allSettled(loadedFarms.map(async (farm) => (await farmCropApi.list(farm.id)).data.map((crop) => ({ ...crop, farmName: farm.name }))))
        if (active) {
          const crops = cropResults.flatMap((item) => item.status === 'fulfilled' ? item.value : [])
          setFarmCrops(crops)
          setSelectedFarmCrop((current) => current || crops[0]?.id || '')
        }
      }
      if (scansResult.status === 'fulfilled') setPredictions(scansResult.value.data)
      const failure = [farmsResult, scansResult].find((item) => item.status === 'rejected')
      if (failure) setError(friendlyFirebaseError(failure.reason, t('dashboardLoadError')))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [t])

  const attention = predictions.filter((p) => p.severity === 'high' || p.severity === 'medium').length
  const healthy = predictions.filter((p) => p.severity === 'none').length
  const loadRisk = async () => {
    if (!selectedFarmCrop || riskLoading) return
    setRiskLoading(true); setError('')
    try { setRisk((await weatherApi.risk(selectedFarmCrop)).data) }
    catch (reason) { setError(friendlyFirebaseError(reason, 'Farm risk could not be loaded. Check that this farm has a verified GPS location.')) }
    finally { setRiskLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">{t('goodDay', { name: user?.name?.split(' ')[0] || 'Farmer' })}</h1>
          <p className="muted mt-1">{t('dashboardSubtitle')}</p>
        </div>
        <Link to="/scan" className="primary-button hidden md:inline-flex"><ScanLine className="w-4 h-4" /> {t('scan')}
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <DashboardCard label={t('totalFarms')} value={loading ? '—' : farms.length} />
        <DashboardCard label={t('totalScans')} value={loading ? '—' : predictions.length} />
        <DashboardCard label={t('healthyResults')} value={loading ? '—' : healthy} accent="forest" />
        <DashboardCard label={t('needsAttention')} value={loading ? '—' : attention} accent="clay" />
      </div>
      {error && <p className="error-box mt-4">{error}</p>}

      <section className="surface p-6 mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wider font-semibold text-[var(--primary)]">Early-warning intelligence</p><h2 className="text-xl font-semibold mt-1">Check farm health before visible damage</h2><p className="text-sm muted mt-1">Turn live weather and crop context into a risk-led scouting mission.</p></div><div className="flex flex-wrap gap-2"><select className="field !w-auto min-w-52" value={selectedFarmCrop} onChange={(event) => { setSelectedFarmCrop(event.target.value); setRisk(null) }} disabled={farmCrops.length === 0}><option value="">{farms.length === 0 ? 'Add a farm first' : 'Select an active crop'}</option>{farmCrops.map((crop) => <option key={crop.id} value={crop.id}>{crop.crop_name} · {crop.farmName}</option>)}</select><button className="primary-button" onClick={loadRisk} disabled={!selectedFarmCrop || riskLoading}>{riskLoading ? <Loader2 className="w-4 animate-spin" /> : <RefreshCw className="w-4" />}{risk ? 'Refresh risk' : 'Generate risk & mission'}</button></div></div>
        {farmCrops.length === 0 && !loading && <p className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm mt-5">Add an active crop to a farm to generate its early-warning risk and guided scouting mission. <Link className="link" to="/farms">Manage farms</Link></p>}
        {risk && <div className="mt-6"><CropRiskPanel risk={risk} /></div>}
      </section>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="md:col-span-2 surface p-6">
          <h2 className="font-display text-lg font-semibold">{t('recentScans')}</h2>
          {predictions.length === 0 ? (
            <div className="mt-6 text-center py-10">
              <Sprout className="w-10 h-10 text-[var(--primary)] opacity-60 mx-auto" />
              <p className="muted mt-3 text-sm">{t('noScansDashboard')}</p>
              <Link to="/scan" className="link inline-flex items-center gap-1.5 mt-4 text-sm">{t('scanACrop')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[var(--border)]">
              {predictions.slice(0, 6).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.disease_name || t('pending')}</p>
                    <p className="text-xs muted">{new Date(p.created_at || Date.now()).toLocaleDateString()} · {(Number(p.confidence) || 0).toFixed(1)}% {t('confidence')}</p>
                  </div>
                  <SeverityBadge severity={p.severity} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface p-6">
          <h2 className="font-display text-lg font-semibold">{t('yourFarms')}</h2>
          {farms.length === 0 ? (
            <div className="mt-4 text-sm muted">{t('noFarms')}<Link to="/farms" className="link block mt-2">{t('addFirstFarm')}</Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {farms.slice(0, 4).map((f) => (
                <Link key={f.id} to="/farms" className="block p-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-muted)] transition-colors">
                  <p className="font-medium text-sm">{f.name}</p><p className="text-xs muted">{f.location} {f.areaAcres ? `· ${f.areaAcres} ${t('acres')}` : ''}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
