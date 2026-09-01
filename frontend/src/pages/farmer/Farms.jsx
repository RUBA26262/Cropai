import { useCallback, useEffect, useState } from 'react'
import { Crosshair, Info, LoaderCircle, MapPin, Plus, Trash2, X } from 'lucide-react'
import { CROP_CATALOG, farmApi, farmCropApi, friendlyFirebaseError, locationApi } from '../../services/api'
import { useI18n } from '../../context/I18nContext'

const empty = { name: '', districtCode: '', districtName: '', talukaCode: '', talukaName: '', villageCode: '', villageName: '', areaAcres: '', soilType: '', irrigationType: '', latitude: null, longitude: null }
const SOIL_TYPES = [
  ['black','Black soil','काळी माती','काली मिट्टी'],['red','Red soil','लाल माती','लाल मिट्टी'],['alluvial','Alluvial soil','गाळाची माती','जलोढ़ मिट्टी'],['laterite','Laterite soil','जांभी माती','लेटराइट मिट्टी'],['sandy','Sandy soil','वाळूची माती','रेतीली मिट्टी'],['clay','Clay soil','चिकणमाती','चिकनी मिट्टी'],['loamy','Loamy soil','पोयटा माती','दोमट मिट्टी'],['saline','Saline/alkaline soil','खारट/चोपण माती','लवणीय/क्षारीय मिट्टी'],
]
const IRRIGATION_TYPES = [
  ['rainfed','Rain-fed','पावसावर आधारित','वर्षा आधारित'],['drip','Drip irrigation','ठिबक सिंचन','ड्रिप सिंचाई'],['sprinkler','Sprinkler','तुषार सिंचन','स्प्रिंकलर'],['canal','Canal','कालवा','नहर'],['open_well','Open well','विहीर','खुला कुआँ'],['borewell','Borewell','बोअरवेल','बोरवेल'],['farm_pond','Farm pond','शेततळे','खेत तालाब'],['flood','Flood irrigation','पाट/प्रवाही सिंचन','बाढ़ सिंचाई'],['lift','Lift irrigation','उपसा सिंचन','लिफ्ट सिंचाई'],
]

export default function Farms() {
  const { locale, t } = useI18n()
  const localLabel = (item) => item[locale === 'mr' ? 2 : locale === 'hi' ? 3 : 1]
  const [farms, setFarms] = useState([])
  const [form, setForm] = useState(empty)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [farmCrops, setFarmCrops] = useState({})
  const [cropSelections, setCropSelections] = useState({})
  const [growthStages, setGrowthStages] = useState({})
  const [sowingDates, setSowingDates] = useState({})
  const [error, setError] = useState('')
  const [districts, setDistricts] = useState([])
  const [talukas, setTalukas] = useState([])
  const [villages, setVillages] = useState([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [manualHierarchy, setManualHierarchy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const items = (await farmApi.list()).data
      setFarms(items)
      const cropResults = await Promise.allSettled(items.map(async (farm) => [farm.id, (await farmCropApi.list(farm.id)).data]))
      setFarmCrops(Object.fromEntries(cropResults.filter((item) => item.status === 'fulfilled').map((item) => item.value)))
    }
    catch (reason) { setError(friendlyFirebaseError(reason, t('farmsLoadError'))) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => { load() }, [load])

  const openFarmForm = async () => {
    setShowForm(true); setLocationError('')
    if (districts.length && !manualHierarchy) return
    setLocationsLoading(true)
    try {
      const options = (await locationApi.districts()).data
      setDistricts(options)
      const usingFallback = options.some((item) => item.fallback) && !options.some((item) => item.bundled)
      setManualHierarchy(usingFallback)
      if (usingFallback) setLocationError('The complete bundled location directory could not be loaded. Districts are still available; reload the app to restore the official taluka and village selectors.')
    }
    catch { setLocationError('The bundled Maharashtra district directory could not be loaded. Reload the app and retry.') }
    finally { setLocationsLoading(false) }
  }

  const chooseDistrict = async (districtCode) => {
    const district = districts.find((item) => item.code === districtCode)
    const fallback = Boolean(district?.fallback || districtCode.startsWith('fallback-')) && !district?.bundled
    setForm((current) => ({ ...current, districtCode, districtName: district?.name || '', talukaCode: fallback ? 'manual' : '', talukaName: '', villageCode: fallback ? 'manual' : '', villageName: '' })); setTalukas([]); setVillages([]); setError(''); setManualHierarchy(fallback)
    if (!districtCode) return
    if (fallback) { setLocationError('Enter the taluka and village manually. They will be stored as user-provided location labels; GPS is still checked for Maharashtra bounds.'); return }
    setLocationsLoading(true)
    try {
      const options = (await locationApi.talukas(districtCode)).data
      if (!options.length) throw new Error('NO_TALUKAS')
      setTalukas(options)
      setLocationError('')
    }
    catch {
      setManualHierarchy(true)
      setForm((current) => ({ ...current, talukaCode: 'manual', villageCode: 'manual' }))
      setLocationError('The bundled taluka directory could not be loaded. Reload the app before saving; GPS is still required and validated.')
    }
    finally { setLocationsLoading(false) }
  }

  const chooseTaluka = async (talukaCode) => {
    const taluka = talukas.find((item) => item.code === talukaCode)
    setForm((current) => ({ ...current, talukaCode, talukaName: taluka?.name || '', villageCode: '', villageName: '' })); setVillages([]); setError('')
    if (!talukaCode) return
    setLocationsLoading(true)
    try {
      const options = (await locationApi.villages(form.districtCode, talukaCode)).data
      if (!options.length) throw new Error('NO_VILLAGES')
      setVillages(options)
      setLocationError('')
    }
    catch {
      setManualHierarchy(true)
      setForm((current) => ({ ...current, villageCode: 'manual' }))
      setLocationError('The bundled village directory could not be loaded. Reload the app before saving; GPS is still required and validated.')
    }
    finally { setLocationsLoading(false) }
  }

  const locate = () => {
    if (!navigator.geolocation) { setError(t('gpsUnavailable')); return }
    navigator.geolocation.getCurrentPosition(
      (position) => setForm((current) => ({ ...current, latitude: Number(position.coords.latitude.toFixed(5)), longitude: Number(position.coords.longitude.toFixed(5)) })),
      () => setError(t('locationDenied')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const submit = async (event) => {
    event.preventDefault(); if (saving) return
    setSaving(true); setError('')
    try {
      if (!form.districtCode || !form.talukaCode || !form.villageCode || !form.districtName || !form.talukaName || !form.villageName) throw new Error('Select or enter district, taluka and village in order.')
      if (form.latitude == null || form.longitude == null) throw new Error('Capture GPS at the farm so weather uses the correct field location.')
      await farmApi.create({ ...form, areaAcres: form.areaAcres ? Number(form.areaAcres) : null })
      setForm(empty); setShowForm(false); await load()
    } catch (reason) { setError(friendlyFirebaseError(reason, t('farmSaveError'))) }
    finally { setSaving(false) }
  }

  const remove = async (farm) => {
    if (!window.confirm(t('deleteFarmConfirm', { name: farm.name }))) return
    setDeletingId(farm.id); setError('')
    try { await farmApi.remove(farm.id); setFarms((current) => current.filter((item) => item.id !== farm.id)) }
    catch (reason) { setError(friendlyFirebaseError(reason, t('farmDeleteError'))) }
    finally { setDeletingId(null) }
  }

  const addCrop = async (farmId) => {
    const cropKey = cropSelections[farmId]
    if (!cropKey) return
    try {
      const response = await farmCropApi.create({ farmId, cropKey, growthStage: growthStages[farmId] || 'unknown', sowingDate: sowingDates[farmId] || null })
      setFarmCrops((current) => ({ ...current, [farmId]: [response.data, ...(current[farmId] || [])] }))
      setCropSelections((current) => ({ ...current, [farmId]: '' }))
      setGrowthStages((current) => ({ ...current, [farmId]: 'unknown' }))
      setSowingDates((current) => ({ ...current, [farmId]: '' }))
    } catch (reason) { setError(friendlyFirebaseError(reason, 'Crop could not be added.')) }
  }

  return <div>
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">{t('myFarms')}</h1><p className="muted mt-1">{t('coordinatesPrivate')}</p></div><button className="primary-button shrink-0" onClick={openFarmForm}><Plus className="w-4" /> {t('addFarm')}</button></div>
    {showForm && <form className="surface p-5 mt-6 relative" onSubmit={submit}>
      <button type="button" className="absolute right-4 top-4 rounded-full p-1 hover:bg-[var(--surface-muted)]" onClick={() => setShowForm(false)} aria-label={t('close')}><X /></button><h2 className="font-semibold">{t('farmDetails')}</h2>
      {locationError && <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl p-3 text-sm ${manualHierarchy ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'error-box'}`}><span>{locationError}</span><button type="button" className="font-semibold underline shrink-0" onClick={openFarmForm}>Retry live list</button></div>}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <label className="field-label">{t('farmName')}<input className="field mt-1" required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="field-label">{t('district')}<select className="field mt-1" required value={form.districtCode} onChange={(event) => chooseDistrict(event.target.value)}><option value="">Select district…</option>{districts.map((item) => <option key={item.code} value={item.code}>{locale === 'mr' ? item.localName : item.name}</option>)}</select></label>
        {manualHierarchy ? <label className="field-label">{t('taluka')}<input className="field mt-1" required maxLength="120" placeholder="Enter taluka" value={form.talukaName} onChange={(event) => setForm({ ...form, talukaCode: 'manual', talukaName: event.target.value })} /></label> : <label className="field-label">{t('taluka')}<select className="field mt-1" required disabled={!form.districtCode || locationsLoading} value={form.talukaCode} onChange={(event) => chooseTaluka(event.target.value)}><option value="">{form.districtCode ? 'Select taluka…' : 'Select district first'}</option>{talukas.map((item) => <option key={item.code} value={item.code}>{locale === 'mr' ? item.localName : item.name}</option>)}</select></label>}
        {manualHierarchy ? <label className="field-label">{t('village')}<input className="field mt-1" required maxLength="120" placeholder="Enter village" value={form.villageName} onChange={(event) => setForm({ ...form, villageCode: 'manual', villageName: event.target.value })} /></label> : <label className="field-label">{t('village')}<select className="field mt-1" required disabled={!form.talukaCode || locationsLoading} value={form.villageCode} onChange={(event) => { const village = villages.find((item) => item.code === event.target.value); setForm({ ...form, villageCode: event.target.value, villageName: village?.name || '', villageLgdCode: village?.lgdCode || null }) }}><option value="">{form.talukaCode ? 'Select village…' : 'Select taluka first'}</option>{villages.map((item) => <option key={item.code} value={item.code}>{locale === 'mr' ? item.localName : item.name}</option>)}</select></label>}
        <label className="field-label">{t('areaAcres')}<input className="field mt-1" type="number" min="0" max="100000" step="0.01" value={form.areaAcres} onChange={(event) => setForm({ ...form, areaAcres: event.target.value })} /></label>
        <label className="field-label">{t('soilType')}<select className="field mt-1" value={form.soilType} onChange={(event) => setForm({ ...form, soilType: event.target.value })}><option value="">{locale === 'mr' ? 'मातीचा प्रकार निवडा' : locale === 'hi' ? 'मिट्टी का प्रकार चुनें' : 'Select soil type'}</option>{SOIL_TYPES.map((item) => <option key={item[0]} value={item[1]}>{localLabel(item)}</option>)}</select></label>
        <label className="field-label">{t('irrigation')}<select className="field mt-1" value={form.irrigationType} onChange={(event) => setForm({ ...form, irrigationType: event.target.value })}><option value="">{locale === 'mr' ? 'सिंचन प्रकार निवडा' : locale === 'hi' ? 'सिंचाई प्रकार चुनें' : 'Select irrigation type'}</option>{IRRIGATION_TYPES.map((item) => <option key={item[0]} value={item[1]}>{localLabel(item)}</option>)}</select></label>
        <div><span className="field-label">{t('weatherLocation')} *</span><button type="button" className="secondary-button mt-1" onClick={locate}><Crosshair className="w-4" /> {t('useGps')}</button>{form.latitude && <p className="text-xs text-green-700 mt-1">{t('locationCaptured')} · {form.latitude}, {form.longitude}</p>}</div>
      </div><button className="primary-button mt-5" disabled={saving}>{saving && <LoaderCircle className="w-4 animate-spin" />}{saving ? t('saving') : t('saveFarm')}</button>
      <div className="mt-4 flex gap-2 rounded-xl bg-[var(--surface-muted)] p-3 text-xs muted"><Info className="w-4 shrink-0" /><p>{manualHierarchy ? 'The district comes from CropAI’s bundled Maharashtra list. Taluka and village are user-entered because the complete directory asset is unavailable; they are not marked official. GPS remains required for point-specific weather.' : 'District, taluka and village come from CropAI’s bundled official Maharashtra directory snapshot. GPS is required for point-specific weather; only a village belonging to the selected taluka can be saved.'}</p></div>
    </form>}
    {error && <div className="error-box mt-4 flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" className="font-semibold underline" onClick={load}>{t('retry')}</button></div>}
    {loading && <div className="surface p-8 mt-6 text-center muted" role="status"><LoaderCircle className="w-7 h-7 animate-spin mx-auto" /><p className="mt-3">{t('loadingFarms')}</p></div>}
    {!loading && farms.length === 0 && !showForm && <div className="surface p-8 mt-6 text-center muted"><p>{t('noFarms')}</p><button className="link mt-2" onClick={openFarmForm}>{t('addFirstFarm')}</button></div>}
    {!loading && <div className="grid md:grid-cols-3 gap-5 mt-6">{farms.map((farm) => <article key={farm.id} className="surface p-5"><div className="flex justify-between gap-2"><h2 className="font-semibold">{farm.name}</h2><button className="rounded-full p-2 text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50" disabled={deletingId === farm.id} onClick={() => remove(farm)} aria-label={t('deleteFarm', { name: farm.name })}>{deletingId === farm.id ? <LoaderCircle className="w-4 animate-spin" /> : <Trash2 className="w-4" />}</button></div><p className="flex items-center gap-1 text-sm muted mt-1"><MapPin className="w-3.5" /> {[farm.village, farm.taluka, farm.district].filter(Boolean).join(', ') || t('locationNotAdded')}</p><div className="text-sm muted mt-3 space-y-1">{farm.areaAcres && <p>{t('area')}: {farm.areaAcres} {t('acres')}</p>}{farm.soilType && <p>{t('soil')}: {farm.soilType}</p>}{farm.irrigationType && <p>{t('irrigation')}: {farm.irrigationType}</p>}</div><div className="mt-4 pt-4 border-t border-[var(--border)]"><p className="text-sm font-semibold">Farm plants</p>{(farmCrops[farm.id] || []).length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{farmCrops[farm.id].map((crop) => <span key={crop.id} className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs">{crop.crop_name}{crop.growthStage && crop.growthStage !== 'unknown' ? ` · ${crop.growthStage}` : ''}</span>)}</div>}<select className="field mt-3 text-sm" value={cropSelections[farm.id] || ''} onChange={(event) => setCropSelections((current) => ({ ...current, [farm.id]: event.target.value }))}><option value="">Select a crop or plant…</option>{CROP_CATALOG.map((crop) => <option key={crop.key} value={crop.key}>{crop.name} · {crop.localName}</option>)}</select><div className="grid grid-cols-2 gap-2 mt-2"><select className="field text-sm" aria-label="Crop growth stage" value={growthStages[farm.id] || 'unknown'} onChange={(event) => setGrowthStages((current) => ({ ...current, [farm.id]: event.target.value }))}><option value="unknown">Stage unknown</option><option value="seedling">Seedling</option><option value="vegetative">Vegetative</option><option value="flowering">Flowering</option><option value="fruiting">Fruiting</option><option value="maturity">Maturity</option></select><input className="field text-sm" type="date" aria-label="Sowing date" value={sowingDates[farm.id] || ''} onChange={(event) => setSowingDates((current) => ({ ...current, [farm.id]: event.target.value }))} /></div><button className="secondary-button mt-2 text-sm" disabled={!cropSelections[farm.id]} onClick={() => addCrop(farm.id)}>Add plant</button></div></article>)}</div>}
  </div>
}
