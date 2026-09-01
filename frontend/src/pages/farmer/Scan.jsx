import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Loader2, Mic, ShieldCheck, UploadCloud } from 'lucide-react'
import { cropApi, farmApi, farmCropApi, friendlyFirebaseError, predictionApi, scanApi, weatherApi } from '../../services/api'
import { useI18n } from '../../context/I18nContext'
import { useAuth } from '../../context/AuthContext'
import { deleteOfflineScan, listOfflineScans, purgeExpiredOfflineScans, saveOfflineScan } from '../../lib/offlineQueue'
import { assessImageQuality } from '../../lib/imageQuality'
import FarmerSignalChart from '../../components/FarmerSignalChart'
import WeatherForecastChart from '../../components/WeatherForecastChart'
import CropRiskPanel from '../../components/CropRiskPanel'

function ImageSlot({ id, title, help, file, quality, onChange, required = true }) {
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  return <label className="surface !shadow-none p-4 cursor-pointer block">
    <div className="aspect-video rounded-xl bg-[var(--surface-muted)] overflow-hidden grid place-items-center">
      {preview ? <img src={preview} className="w-full h-full object-cover" alt="Selected crop" /> : <Camera className="w-8 h-8 muted" />}
    </div>
    <div className="mt-3 flex items-start justify-between gap-2"><div><p className="font-semibold text-sm">{title} {required && <span className="text-red-600">*</span>}</p><p className="text-xs muted mt-1">{help}</p></div><UploadCloud className="w-4 h-4 shrink-0 text-[var(--primary)]" /></div>
    {quality && <div className={`mt-3 rounded-lg p-2 text-xs ${quality.level === 'reject' ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200' : quality.level === 'warning' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200' : 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200'}`}>
      <strong>{quality.level === 'reject' ? 'Retake required: ' : quality.level === 'warning' ? 'Photo check: ' : 'Quality check: '}</strong>{quality.guidance}
    </div>}
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] || null)} />
  </label>
}

const cropRisks = {
  wheat: ['Leaf rust or fungal leaf spot', 'Aphid or other sap-sucking pest'],
  rice: ['Blast or bacterial leaf disease', 'Stem borer or leaf-folder damage'],
  maize: ['Leaf blight or rust', 'Fall armyworm or stem-borer damage'],
  cotton: ['Leaf spot or wilt stress', 'Whitefly, aphid or bollworm damage'],
  tomato: ['Early/late blight or leaf spot', 'Whitefly, aphid or fruit-borer damage'],
  potato: ['Early/late blight', 'Aphid or tuber-moth damage'],
  chilli: ['Leaf curl or fungal leaf spot', 'Thrips, mites or aphids'],
  sugarcane: ['Red-rot, smut or leaf disease', 'Shoot-borer or scale-insect damage'],
  soybean: ['Rust or leaf spot', 'Girdle beetle or defoliator damage'],
  onion: ['Purple blotch or downy mildew', 'Thrips damage'],
}

function preliminaryAssessment(cropKey, symptoms) {
  const risks = cropRisks[cropKey] || ['Fungal, bacterial or nutrient-related leaf stress', 'Possible insect or mite damage']
  const pestLikely = symptoms.visiblePests === 'few' || symptoms.visiblePests === 'many'
  const severe = symptoms.spreadSpeed === 'fast' || symptoms.affectedArea === 'whole_plant' || symptoms.visiblePests === 'many'
  const moderate = symptoms.affectedArea === 'many_leaves' || symptoms.visiblePests === 'few'
  const severity = severe ? 'High' : moderate ? 'Medium' : 'Low'
  const pestScore = symptoms.visiblePests === 'many' ? 85 : symptoms.visiblePests === 'few' ? 65 : symptoms.visiblePests === 'none' ? 15 : 35
  const diseaseScore = pestLikely ? 35 : symptoms.spreadSpeed === 'fast' ? 80 : symptoms.affectedArea === 'many_leaves' || symptoms.affectedArea === 'whole_plant' ? 68 : 52
  const stressScore = Math.max(20, 100 - Math.max(pestScore, diseaseScore) + (symptoms.affectedArea === 'unknown' ? 15 : 0))
  return {
    title: pestLikely ? risks[1] : risks[0],
    severity,
    confidence: symptoms.affectedArea !== 'unknown' && symptoms.spreadSpeed !== 'unknown' && symptoms.visiblePests !== 'unknown' ? 'Moderate' : 'Low',
    indicators: [
      { label: 'Disease pattern', value: diseaseScore, color: '#dc6b2f' },
      { label: 'Pest pattern', value: pestScore, color: '#8a5a25' },
      { label: 'Environmental / nutrient stress', value: Math.min(stressScore, 60), color: '#5b8c5a' },
    ],
    actions: pestLikely
      ? ['Isolate heavily affected plants and inspect the underside of leaves.', 'Use traps or manual removal where practical; avoid routine broad-spectrum spraying.', 'Ask a local agriculture officer to identify the pest before applying pesticide.']
      : ['Remove badly affected leaves and avoid overhead watering.', 'Improve spacing and airflow; disinfect cutting tools between plants.', 'Seek local expert confirmation before applying fungicide or bactericide.'],
  }
}

export default function Scan() {
  const { locale, t } = useI18n()
  const { user } = useAuth()
  const [farms, setFarms] = useState([]); const [crops, setCrops] = useState([]); const [farmCrops, setFarmCrops] = useState([])
  const [selectedFarm, setSelectedFarm] = useState(''); const [selectedFarmCrop, setSelectedFarmCrop] = useState(''); const [selectedCropToAdd, setSelectedCropToAdd] = useState('')
  const [newCropStage, setNewCropStage] = useState('unknown')
  const [files, setFiles] = useState({ closeup: null, plant: null, context: null })
  const [imageQuality, setImageQuality] = useState({ closeup: null, plant: null, context: null })
  const [symptoms, setSymptoms] = useState({ affectedArea: 'unknown', spreadSpeed: 'unknown', visiblePests: 'unknown', notes: '' })
  const [status, setStatus] = useState('idle'); const [message, setMessage] = useState(''); const [scanId, setScanId] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [risk, setRisk] = useState(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [listening, setListening] = useState(false); const recognitionRef = useRef(null)
  useEffect(() => {
    let active = true
    Promise.allSettled([farmApi.list(), cropApi.list()]).then(([farmResult, cropResult]) => {
      if (!active) return
      if (farmResult.status === 'fulfilled') setFarms(farmResult.value.data)
      if (cropResult.status === 'fulfilled') setCrops(cropResult.value.data)
      const failure = [farmResult, cropResult].find((item) => item.status === 'rejected')
      if (failure) { setStatus('failed'); setMessage(friendlyFirebaseError(failure.reason, 'Farm and crop options could not be loaded.')) }
    })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let syncing = false
    const sync = async () => {
      if (syncing || !navigator.onLine || !user) return
      syncing = true
      try {
        await purgeExpiredOfflineScans()
        for (const pending of (await listOfflineScans()).filter((item) => item.ownerUid === user.uid)) {
          const session = await scanApi.createSession(pending.farmCropId, pending.locale)
          for (const [slot, file] of Object.entries(pending.files)) if (file) await scanApi.upload(session.data.scanId, slot, file)
          await scanApi.submit(session.data.scanId, pending.symptoms, pending.idempotencyKey)
          await deleteOfflineScan(pending.id)
        }
      } catch { /* Keep the private draft for the next online event. */ }
      finally { syncing = false }
    }
    sync(); window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [user])
  useEffect(() => {
    let active = true
    if (!selectedFarm) { setFarmCrops([]); return () => { active = false } }
    farmCropApi.list(selectedFarm).then((r) => { if (active) setFarmCrops(r.data) }).catch((error) => { if (active) { setStatus('failed'); setMessage(friendlyFirebaseError(error, 'Planted crops could not be loaded.')) } })
    return () => { active = false }
  }, [selectedFarm])
  useEffect(() => () => recognitionRef.current?.stop(), [])
  const captureVoice = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { setMessage('Voice recognition is unavailable in this browser.'); return }
    if (listening) { recognitionRef.current?.stop(); return }
    const recognition = new Recognition(); recognition.lang = locale === 'mr' ? 'mr-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN'
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false)
    recognition.onresult = (event) => setSymptoms((current) => ({ ...current, notes: `${current.notes} ${event.results[0][0].transcript}`.trim().slice(0, 500) }))
    recognitionRef.current = recognition; recognition.start()
  }
  const setFile = async (slot, file) => {
    if (file && (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setMessage('Use a JPG, PNG or WebP image smaller than 5 MB.'); return }
    setMessage('')
    setFiles((current) => ({ ...current, [slot]: file }))
    setImageQuality((current) => ({ ...current, [slot]: file ? { level: 'checking', guidance: 'Checking photo quality…' } : null }))
    if (!file) return
    const quality = await assessImageQuality(file)
    setImageQuality((current) => ({ ...current, [slot]: quality }))
    if (quality.level === 'reject') {
      setStatus('failed')
      setMessage(`${slot === 'closeup' ? 'Affected-area' : slot === 'plant' ? 'Whole-plant' : 'Context'} photo: ${quality.guidance}`)
    } else {
      setStatus((current) => current === 'failed' ? 'idle' : current)
      setMessage('')
    }
  }
  const addCrop = async () => {
    if (!selectedFarm || !selectedCropToAdd) return
    const response = await farmCropApi.create({ farmId: selectedFarm, cropKey: selectedCropToAdd, growthStage: newCropStage })
    setFarmCrops((current) => [response.data, ...current]); setSelectedFarmCrop(response.data.id)
  }
  const loadRisk = async () => {
    if (!selectedFarmCrop || riskLoading) return
    setRiskLoading(true); setMessage('')
    try { setRisk((await weatherApi.risk(selectedFarmCrop)).data) }
    catch (error) { setStatus('failed'); setMessage(friendlyFirebaseError(error, 'Weather risk could not be loaded. Try again when connected.')) }
    finally { setRiskLoading(false) }
  }
  const analyze = async () => {
    if (!selectedFarmCrop || !files.closeup || !files.plant) return
    const rejectedSlot = ['closeup', 'plant'].find((slot) => imageQuality[slot]?.level === 'reject')
    if (rejectedSlot) {
      setStatus('failed')
      setMessage(`${rejectedSlot === 'closeup' ? 'Affected-area' : 'Whole-plant'} photo must be retaken before analysis. ${imageQuality[rejectedSlot].guidance}`)
      return
    }
    if (!navigator.onLine) {
      await saveOfflineScan({ ownerUid: user.uid, farmCropId: selectedFarmCrop, locale, files, symptoms, idempotencyKey: crypto.randomUUID() })
      setStatus('queued'); setMessage('Saved privately on this device. It will upload automatically when connectivity returns and will expire after 24 hours.')
      return
    }
    setAssessment(null); setStatus('uploading'); setMessage('Creating a private upload session…')
    try {
      const session = await scanApi.createSession(selectedFarmCrop, locale); setScanId(session.data.scanId)
      for (const [slot, file] of Object.entries(files)) if (file) { setMessage(`Securely uploading ${slot} image…`); await scanApi.upload(session.data.scanId, slot, file) }
      setMessage('Images uploaded. Queuing validated model inference…')
      const response = await scanApi.submit(session.data.scanId, symptoms)
      if (response.data.status === 'failed') {
        const preliminary = preliminaryAssessment(farmCrops.find((crop) => crop.id === selectedFarmCrop)?.cropKey, symptoms)
        setStatus('assessed')
        setAssessment(preliminary)
        predictionApi.saveLocal({ id: session.data.scanId, farmCropId: selectedFarmCrop, status: 'preliminary', result: { conditionId: preliminary.title, confidence: preliminary.confidence === 'Moderate' ? 0.55 : 0.35, severity: preliminary.severity.toLowerCase(), preliminary: true, indicators: preliminary.indicators, actions: preliminary.actions } })
        setMessage('')
      }
      else { setStatus('queued'); setMessage('Scan queued securely. The result will appear in History and Alerts after validation.') }
    } catch (error) {
      const preliminary = preliminaryAssessment(farmCrops.find((crop) => crop.id === selectedFarmCrop)?.cropKey, symptoms)
      setStatus('assessed')
      setAssessment(preliminary)
      predictionApi.saveLocal({ id: scanId || undefined, farmCropId: selectedFarmCrop, status: 'preliminary', result: { conditionId: preliminary.title, confidence: preliminary.confidence === 'Moderate' ? 0.55 : 0.35, severity: preliminary.severity.toLowerCase(), preliminary: true, indicators: preliminary.indicators, actions: preliminary.actions } })
      console.warn('Online image analysis unavailable; showing preliminary assessment.', friendlyFirebaseError(error))
      setMessage('')
    }
  }
  return <div className="max-w-4xl mx-auto">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">{t('scanTitle')}</h1><p className="muted mt-1">{t('scanSubtitle')}</p></div><span className="hidden sm:flex items-center gap-1 text-xs muted"><ShieldCheck className="w-4" /> {t('privateImages')}</span></div>
    <section className="surface p-5 mt-6"><h2 className="font-semibold">{t('selectCropStep')}</h2><div className="grid md:grid-cols-2 gap-4 mt-4"><label className="field-label">{t('farm')}<select className="field mt-1" value={selectedFarm} onChange={(e) => { setSelectedFarm(e.target.value); setSelectedFarmCrop(''); setRisk(null) }}><option value="">{t('selectFarm')}</option>{farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label><label className="field-label">{t('activeCrop')}<select className="field mt-1" value={selectedFarmCrop} onChange={(e) => { setSelectedFarmCrop(e.target.value); setRisk(null) }} disabled={!selectedFarm}><option value="">{t('selectPlantedCrop')}</option>{farmCrops.map((crop) => <option key={crop.id} value={crop.id}>{crop.crop_name}{crop.growthStage && crop.growthStage !== 'unknown' ? ` · ${crop.growthStage}` : ''}</option>)}</select></label></div>{selectedFarm && <div className="flex flex-wrap gap-2 mt-3"><select className="field !w-auto" value={selectedCropToAdd} onChange={(e) => setSelectedCropToAdd(e.target.value)}><option value="">{t('addCropToFarm')}</option>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.name} · {crop.localName}</option>)}</select><select className="field !w-auto" value={newCropStage} onChange={(e) => setNewCropStage(e.target.value)} aria-label="Growth stage"><option value="unknown">Growth stage unknown</option><option value="seedling">Seedling</option><option value="vegetative">Vegetative</option><option value="flowering">Flowering</option><option value="fruiting">Fruiting</option><option value="maturity">Maturity</option></select><button className="secondary-button" onClick={addCrop} disabled={!selectedCropToAdd}>{t('add')}</button>{selectedFarmCrop && <button className="secondary-button" onClick={loadRisk} disabled={riskLoading}>{riskLoading ? <><Loader2 className="w-4 animate-spin" /> Loading risk…</> : t('weatherRisk')}</button>}</div>}</section>
    {risk && <section className="surface p-5 mt-5"><div className="flex flex-wrap items-start justify-between gap-2 mb-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">GPS-point weather</p><h2 className="font-semibold">{risk.location?.name || 'Saved farm location'}</h2><p className="text-xs muted">{risk.current?.temperature ?? '—'}°C · {risk.current?.humidity ?? '—'}% humidity · {risk.current?.precipitation ?? '—'} mm rain</p></div></div><CropRiskPanel risk={risk} />{Array.isArray(risk.forecast) && risk.forecast.length > 0 && <div className="mt-5"><p className="font-semibold">7-day weather detail</p><WeatherForecastChart forecast={risk.forecast} /></div>}</section>}
    <section className="mt-6"><h2 className="font-semibold">{t('captureEvidence')}</h2><p className="text-sm muted mt-1">Low-cost phones are supported. We check focus, lighting, resolution and visible detail before upload; unusable photos must be retaken.</p><div className="grid sm:grid-cols-3 gap-4 mt-3"><ImageSlot id="closeup" title={t('affectedCloseup')} help={t('closeupHelp')} file={files.closeup} quality={imageQuality.closeup} onChange={(file) => setFile('closeup', file)} /><ImageSlot id="plant" title={t('wholePlant')} help={t('wholePlantHelp')} file={files.plant} quality={imageQuality.plant} onChange={(file) => setFile('plant', file)} /><ImageSlot id="context" title={t('fieldContext')} help={t('fieldContextHelp')} file={files.context} quality={imageQuality.context} onChange={(file) => setFile('context', file)} required={false} /></div></section>
    <section className="surface p-5 mt-6"><h2 className="font-semibold">{t('symptomsStep')}</h2><div className="grid sm:grid-cols-3 gap-4 mt-4"><label className="field-label">{t('affectedArea')}<select className="field mt-1" value={symptoms.affectedArea} onChange={(e) => setSymptoms({ ...symptoms, affectedArea: e.target.value })}><option value="unknown">{t('notSure')}</option><option value="few_leaves">{t('fewLeaves')}</option><option value="many_leaves">{t('manyLeaves')}</option><option value="whole_plant">{t('wholePlantOption')}</option></select></label><label className="field-label">{t('spreadSpeed')}<select className="field mt-1" value={symptoms.spreadSpeed} onChange={(e) => setSymptoms({ ...symptoms, spreadSpeed: e.target.value })}><option value="unknown">{t('notSure')}</option><option value="slow">{t('slow')}</option><option value="fast">{t('fast')}</option></select></label><label className="field-label">{t('visiblePests')}<select className="field mt-1" value={symptoms.visiblePests} onChange={(e) => setSymptoms({ ...symptoms, visiblePests: e.target.value })}><option value="unknown">{t('notSure')}</option><option value="none">{t('none')}</option><option value="few">{t('few')}</option><option value="many">{t('many')}</option></select></label></div><label className="field-label mt-4">{t('observations')}<textarea className="field mt-1" rows="3" maxLength="500" value={symptoms.notes} onChange={(e) => setSymptoms({ ...symptoms, notes: e.target.value })} /></label><button type="button" className="secondary-button mt-2" onClick={captureVoice}><Mic className={`w-4 ${listening ? 'text-red-500 animate-pulse' : ''}`} />{listening ? (locale === 'mr' ? 'ऐकत आहे…' : locale === 'hi' ? 'सुन रहा है…' : 'Listening…') : (locale === 'mr' ? 'लक्षणे बोला' : locale === 'hi' ? 'लक्षण बोलें' : 'Speak symptoms')}</button></section>
    <button className="primary-button w-full mt-6 py-3" onClick={analyze} disabled={!selectedFarmCrop || !files.closeup || !files.plant || status === 'uploading' || imageQuality.closeup?.level === 'checking' || imageQuality.plant?.level === 'checking' || imageQuality.closeup?.level === 'reject' || imageQuality.plant?.level === 'reject'}>{status === 'uploading' ? <><Loader2 className="w-4 animate-spin" /> {t('processingSecurely')}</> : t('submitAnalysis')}</button>
    {message && <div className={`mt-4 flex gap-2 p-4 rounded-xl ${status === 'failed' ? 'error-box' : 'surface !shadow-none'}`}>{status === 'failed' ? <AlertTriangle className="w-5 shrink-0" /> : <CheckCircle2 className="w-5 shrink-0 text-[var(--primary)]" />}<div><p>{message}</p>{scanId && <p className="text-xs muted mt-1">{t('reference')}: {scanId}</p>}</div></div>}
    {assessment && <section className="surface p-5 mt-4 border-l-4 border-l-amber-500" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Preliminary symptom-based assessment</p><h2 className="text-xl font-semibold mt-1">{assessment.title}</h2></div><span className={`severity-badge ${assessment.severity.toLowerCase()}`}>{assessment.severity} severity</span></div>
      <p className="text-sm muted mt-2">Assessment confidence: {assessment.confidence}. The uploaded photos have not been processed by a validated image model.</p>
      <div className="mt-5"><FarmerSignalChart indicators={assessment.indicators} /></div>
      <h3 className="font-semibold mt-4">Recommended next steps</h3><ul className="list-disc pl-5 mt-2 space-y-1 text-sm">{assessment.actions.map((action) => <li key={action}>{action}</li>)}</ul>
      <p className="text-sm font-medium text-red-700 mt-4">Do not apply chemicals based only on this preliminary result. Confirm with a local agricultural officer or plant-health expert.</p>
    </section>}
  </div>
}
