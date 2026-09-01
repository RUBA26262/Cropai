import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes } from 'firebase/storage'
import { getToken } from 'firebase/messaging'
import { auth, db, functions, getMessagingSafely, storage } from '../lib/firebase'
import { MAHARASHTRA_DISTRICTS } from '../lib/locationFallback'
import { buildScoutingMission, calculateCropRisk } from '../lib/riskEngine'

const result = (data) => ({ data })
const withId = (snapshot) => ({ id: snapshot.id, ...snapshot.data() })
const uid = () => { if (!auth.currentUser) throw new Error('Authentication required'); return auth.currentUser.uid }
const call = (name) => httpsCallable(functions, name)
const newestFirst = (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
const readLocalArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    localStorage.removeItem(key)
    return []
  }
}
export const friendlyFirebaseError = (error, fallback = 'Something went wrong. Please try again.') => {
  const code = error?.code || ''
  const message = String(error?.message || '')
  if (code.includes('permission-denied')) return 'Your account does not have permission for this action. Sign out and sign in again.'
  if (code.includes('unavailable') || code.includes('network-request-failed')) return 'Firebase is temporarily unreachable. Check your internet connection and try again.'
  if (code.includes('unauthenticated')) return 'Your session has expired. Please sign in again.'
  if (code.includes('deadline-exceeded')) return 'The request took too long. Please retry.'
  if (code.includes('failed-precondition')) {
    if (message.includes('TALUKA_NOT_IN_DISTRICT')) return 'That taluka does not belong to the selected district. Please select it again.'
    if (message.includes('VILLAGE_NOT_IN_TALUKA')) return 'That village does not belong to the selected taluka. Please select it again.'
    if (message.includes('INVALID_DISTRICT')) return 'The selected district is not valid.'
    if (message.includes('FARM_LOCATION_UNVERIFIED')) return 'This older farm has no verified district–taluka–village mapping. Add it again with the new location form.'
    if (message.includes('FARM_LOCATION_REQUIRED')) return 'Capture the farm GPS location before checking weather.'
    if (message.includes('REQUIRED_IMAGES_MISSING')) return 'Both the affected-area and whole-plant images are required. Select them again and retry.'
    if (message.includes('INVALID_SCAN_STATE')) return 'This scan was already submitted. Start a new scan and try again.'
    return 'The scan cannot be submitted in its current state. Start a new scan and retry.'
  }
  if (code.includes('internal') || /^internal(?:\s*\[\d+\])?$/i.test(message.trim())) return 'The requested service is temporarily unavailable. Please retry.'
  return message || fallback
}
export const CROP_CATALOG = [
  ['cotton','Cotton','कापूस'],['soybean','Soybean','सोयाबीन'],['sugarcane','Sugarcane','ऊस'],['onion','Onion','कांदा'],['tomato','Tomato','टोमॅटो'],['pomegranate','Pomegranate','डाळिंब'],
  ['rice','Rice','भात'],['wheat','Wheat','गहू'],['maize','Maize','मका'],['sorghum','Sorghum (Jowar)','ज्वारी'],['pearl_millet','Pearl millet (Bajra)','बाजरी'],['finger_millet','Finger millet (Ragi)','नाचणी'],
  ['chickpea','Chickpea (Gram)','हरभरा'],['pigeon_pea','Pigeon pea (Tur)','तूर'],['green_gram','Green gram (Moong)','मूग'],['black_gram','Black gram (Urad)','उडीद'],['lentil','Lentil','मसूर'],['pea','Pea','वाटाणा'],
  ['groundnut','Groundnut','भुईमूग'],['sunflower','Sunflower','सूर्यफूल'],['sesame','Sesame','तीळ'],['mustard','Mustard','मोहरी'],['safflower','Safflower','करडई'],['castor','Castor','एरंडी'],
  ['potato','Potato','बटाटा'],['sweet_potato','Sweet potato','रताळे'],['brinjal','Brinjal','वांगी'],['chilli','Chilli','मिरची'],['okra','Okra','भेंडी'],['cabbage','Cabbage','कोबी'],['cauliflower','Cauliflower','फुलकोबी'],['carrot','Carrot','गाजर'],['radish','Radish','मुळा'],['cucumber','Cucumber','काकडी'],['pumpkin','Pumpkin','भोपळा'],['bottle_gourd','Bottle gourd','दुधी भोपळा'],['bitter_gourd','Bitter gourd','कारले'],
  ['banana','Banana','केळी'],['mango','Mango','आंबा'],['grape','Grape','द्राक्ष'],['orange','Orange','संत्रे'],['lemon','Lemon','लिंबू'],['guava','Guava','पेरू'],['papaya','Papaya','पपई'],['watermelon','Watermelon','कलिंगड'],['muskmelon','Muskmelon','खरबूज'],['custard_apple','Custard apple','सीताफळ'],['coconut','Coconut','नारळ'],['cashew','Cashew','काजू'],
  ['turmeric','Turmeric','हळद'],['ginger','Ginger','आले'],['garlic','Garlic','लसूण'],['coriander','Coriander','कोथिंबीर'],['cumin','Cumin','जिरे'],['fenugreek','Fenugreek','मेथी'],['tea','Tea','चहा'],['coffee','Coffee','कॉफी'],['rubber','Rubber','रबर'],['tobacco','Tobacco','तंबाखू'],['fodder','Fodder crop','चारा पीक'],
].map(([key, name, localName]) => ({ key, name, localName }))

export const farmApi = {
  list: async () => {
    const ownerUid = uid()
    try {
      return result((await getDocs(query(collection(db, 'farms'), where('ownerUid', '==', ownerUid), orderBy('createdAt', 'desc')))).docs.map(withId))
    } catch (error) {
      if (error?.code !== 'failed-precondition') throw error
      const items = (await getDocs(query(collection(db, 'farms'), where('ownerUid', '==', ownerUid)))).docs.map(withId)
      return result(items.sort(newestFirst))
    }
  },
  create: async (data) => {
    if (import.meta.env.VITE_USE_DIRECT_FARM_WRITES !== 'true') {
      try { return result((await call('createFarm')(data)).data) }
      catch (error) {
        const code = String(error?.code || '')
        const message = String(error?.message || '')
        if (!code.includes('not-found') && !code.includes('unavailable') && !message.includes('not-found')) throw error
      }
    }
      if (String(data.districtCode).startsWith('fallback-') || data.talukaCode === 'manual' || data.villageCode === 'manual') {
        throw new Error('The complete bundled location directory is unavailable. Reload the app before saving this farm; manual location labels cannot be marked as officially verified.')
      }
      const ownerUid = uid()
      const payload = {
        ownerUid,
        name: String(data.name || '').trim(),
        district: String(data.districtName || '').trim(), districtCode: String(data.districtCode || '').trim(),
        taluka: String(data.talukaName || '').trim(), talukaCode: String(data.talukaCode || '').trim(),
        village: String(data.villageName || '').trim(), villageCode: String(data.villageCode || '').trim(),
        villageLgdCode: data.villageLgdCode || null,
        location: [data.villageName, data.talukaName, data.districtName].filter(Boolean).join(', '),
        latitude: Number(data.latitude), longitude: Number(data.longitude), locationSource: 'device_gps',
        locationHierarchyVerified: false, locationHierarchySource: 'bundled_official_directory_client',
        areaAcres: data.areaAcres == null ? null : Number(data.areaAcres), soilType: String(data.soilType || ''), irrigationType: String(data.irrigationType || ''),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }
      const saved = await addDoc(collection(db, 'farms'), payload)
      return result({ id: saved.id, ...payload })
  },
  get: async (farmId) => result(withId(await getDoc(doc(db, 'farms', farmId)))),
  update: async (farmId, data) => { await updateDoc(doc(db, 'farms', farmId), { ...data, updatedAt: serverTimestamp() }); return result({ id: farmId, ...data }) },
  remove: async (farmId) => { await deleteDoc(doc(db, 'farms', farmId)); return result(null) },
}

export const locationApi = {
  districts: async () => {
    try {
      const manifestResponse = await fetch('/location/manifest.json', { cache: 'no-cache' })
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json()
        if (Array.isArray(manifest.districts) && manifest.districts.length) return result(manifest.districts.map((item) => ({ ...item, bundled: true })))
      }
      const options = (await call('getLocationOptions')({ level: 'districts' })).data.options
      return result(Array.isArray(options) && options.length ? options : MAHARASHTRA_DISTRICTS)
    } catch (error) { return result(MAHARASHTRA_DISTRICTS.map((item) => ({ ...item, fallbackReason: friendlyFirebaseError(error) }))) }
  },
  talukas: async (districtCode) => {
    try {
      const response = await fetch(`/location/districts/${encodeURIComponent(districtCode)}.json`)
      if (response.ok) return result((await response.json()).talukas.map(({ villages, ...taluka }) => ({ ...taluka, villageCount: villages.length, bundled: true })))
    } catch { /* Continue to callable/manual fallback. */ }
    if (districtCode.startsWith('fallback-')) return result([])
    return result((await call('getLocationOptions')({ level: 'talukas', districtCode })).data.options)
  },
  villages: async (districtCode, talukaCode) => {
    try {
      const response = await fetch(`/location/districts/${encodeURIComponent(districtCode)}.json`)
      if (response.ok) {
        const district = await response.json()
        const taluka = district.talukas.find((item) => item.code === talukaCode)
        if (taluka) return result(taluka.villages.map((item) => ({ ...item, bundled: true })))
      }
    } catch { /* Continue to callable/manual fallback. */ }
    if (districtCode.startsWith('fallback-') || talukaCode === 'manual') return result([])
    return result((await call('getLocationOptions')({ level: 'villages', districtCode, talukaCode })).data.options)
  },
}

export const farmCropApi = {
  list: async (farmId) => {
    const constraints = [where('ownerUid', '==', uid())]
    if (farmId) constraints.push(where('farmId', '==', farmId))
    constraints.push(orderBy('createdAt', 'desc'))
    return result((await getDocs(query(collection(db, 'farmCrops'), ...constraints))).docs.map((item) => { const data = withId(item); return { ...data, crop_name: CROP_CATALOG.find((crop) => crop.key === data.cropKey)?.name || data.cropKey } }))
  },
  create: async (data) => {
    const ownerUid = uid()
    const payload = { ownerUid, farmId: data.farm_id || data.farmId, cropKey: data.cropKey || data.crop_id, season: data.season || '', sowingDate: data.sowingDate || null, growthStage: data.growthStage || 'unknown', status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    const saved = await addDoc(collection(db, 'farmCrops'), payload)
    return result({ id: saved.id, ...payload, crop_name: CROP_CATALOG.find((crop) => crop.key === payload.cropKey)?.name })
  },
}

export const cropApi = { list: async () => result(CROP_CATALOG.map((crop) => ({ id: crop.key, ...crop }))) }
export const conditionApi = { get: async (conditionId) => { const snapshot = await getDoc(doc(db, 'conditionCatalog', conditionId)); return result(snapshot.exists() ? withId(snapshot) : null) } }
export const scanApi = {
  createSession: async (farmCropId, language) => result((await call('createScanSession')({ farmCropId, language })).data),
  upload: async (scanId, slot, file) => { const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'; await uploadBytes(ref(storage, `quarantine/${uid()}/${scanId}/${slot}.${extension}`), file, { contentType: file.type, customMetadata: { slot, scanId } }) },
  submit: async (scanId, symptoms, idempotencyKey = crypto.randomUUID()) => result((await call('submitScan')({ scanId, symptoms, idempotencyKey })).data),
  cancel: async (scanId) => result((await call('cancelScan')({ scanId })).data),
  requestReview: async (scanId) => result((await call('requestExpertReview')({ scanId })).data),
}

export const predictionApi = {
  saveLocal: (data) => {
    const ownerUid = uid()
    const key = `cropai:history:${ownerUid}`
    const items = readLocalArray(key)
    const saved = { ...data, id: data.id || `local_${crypto.randomUUID()}`, ownerUid, isLocal: true, createdAtIso: new Date().toISOString() }
    localStorage.setItem(key, JSON.stringify([saved, ...items.filter((item) => item.id !== saved.id)].slice(0, 100)))
    return result(saved)
  },
  list: async () => {
    const ownerUid = uid()
    const local = readLocalArray(`cropai:history:${ownerUid}`).map((data) => ({ ...data, disease_name: data.result?.conditionId || data.status, confidence: (data.result?.confidence || 0) * 100, severity: data.result?.severity || 'unknown', is_mock: false, created_at: new Date(data.createdAtIso) }))
    let remote = []
    try {
      remote = (await getDocs(query(collection(db, 'scans'), where('ownerUid', '==', ownerUid), limit(100)))).docs.map((item) => {
        const data = withId(item)
        return { ...data, disease_name: data.result?.conditionId || (data.result?.uncertain ? 'Unable to diagnose reliably' : data.status), confidence: (data.result?.confidence || 0) * 100, severity: data.result?.severity || 'unknown', is_mock: false, created_at: data.createdAt?.toDate?.() || new Date() }
      })
    } catch (error) {
      if (local.length === 0) throw error
    }
    const combined = new Map(remote.map((item) => [item.id, item]))
    local.forEach((item) => combined.set(item.id, { ...(combined.get(item.id) || {}), ...item }))
    return result([...combined.values()].sort((a, b) => b.created_at - a.created_at))
  },
  get: async (scanId) => result(withId(await getDoc(doc(db, 'scans', scanId)))),
}
export const alertApi = {
  list: async () => result((await getDocs(query(collection(db, 'alerts'), where('recipientUid', '==', uid()), orderBy('createdAt', 'desc'), limit(100)))).docs.map((item) => { const data = withId(item); return { ...data, is_read: data.read, created_at: data.createdAt?.toDate?.() || new Date() } })),
  markRead: async (alertId) => result((await call('markAlertRead')({ alertId })).data),
}
export const expertApi = {
  requestVerification: async (data) => result((await call('requestExpertVerification')(data)).data),
  queue: async () => result((await getDocs(query(collection(db, 'expertReviews'), where('assignedExpertUid', '==', uid()), where('status', '==', 'assigned'), orderBy('createdAt', 'desc')))).docs.map(withId)),
  submit: async (data) => result((await call('submitExpertReview')(data)).data),
}
export const adminApi = {
  pendingExperts: async () => result((await getDocs(query(collection(db, 'expertVerificationRequests'), where('status', '==', 'pending'), limit(100)))).docs.map(withId)),
  approveExpert: async (userId, approved, reason = '') => result((await call('approveExpert')({ uid: userId, approved, reason })).data),
  outbreaks: async () => result((await getDocs(query(collection(db, 'outbreakAggregates'), orderBy('generatedAt', 'desc'), limit(50)))).docs.map(withId)),
}
export const profileApi = {
  update: async (data) => { await updateDoc(doc(db, 'users', uid()), { ...data, updatedAt: serverTimestamp() }); return result(data) },
  export: async () => result((await call('exportMyData')()).data),
  remove: async () => result((await call('deleteMyAccount')({ confirmation: 'DELETE' })).data),
}
export const weatherApi = {
  risk: async (farmCropId) => {
    const cacheKey = `cropai:risk:${uid()}:${farmCropId}`
    try {
      let data
      try {
        data = (await call('refreshFarmRisk')({ farmCropId })).data
      } catch {
        const farmCropSnapshot = await getDoc(doc(db, 'farmCrops', farmCropId))
        if (!farmCropSnapshot.exists() || farmCropSnapshot.data().ownerUid !== uid()) throw new Error('The selected crop could not be found.')
        const farmCrop = farmCropSnapshot.data()
        const farmSnapshot = await getDoc(doc(db, 'farms', farmCrop.farmId))
        if (!farmSnapshot.exists() || farmSnapshot.data().ownerUid !== uid()) throw new Error('The farm linked to this crop could not be found.')
        const farm = farmSnapshot.data()
        const latitude = Number(farm.latitude)
        const longitude = Number(farm.longitude)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Capture the farm GPS location before checking weather.')
        const url = new URL('https://api.open-meteo.com/v1/forecast')
        url.searchParams.set('latitude', String(latitude))
        url.searchParams.set('longitude', String(longitude))
        url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m')
        url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max')
        url.searchParams.set('timezone', 'auto')
        url.searchParams.set('forecast_days', '7')
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!response.ok) throw new Error('Live weather is temporarily unavailable.')
        const payload = await response.json()
        const current = payload.current || {}
        const daily = payload.daily || {}
        const context = { cropKey: farmCrop.cropKey, growthStage: farmCrop.growthStage, irrigationType: farm.irrigationType }
        const risk = calculateCropRisk({ temperature: current.temperature_2m, humidity: current.relative_humidity_2m, precipitation: current.precipitation, rainProbability: daily.precipitation_probability_max?.[0], windSpeed: current.wind_speed_10m }, context)
        const forecast = (daily.time || []).slice(0, 7).map((date, index) => ({ date, weatherCode: daily.weather_code?.[index], maxTemperature: daily.temperature_2m_max?.[index], minTemperature: daily.temperature_2m_min?.[index], precipitation: daily.precipitation_sum?.[index], rainProbability: daily.precipitation_probability_max?.[index], maxWindSpeed: daily.wind_speed_10m_max?.[index] }))
        const forecastRisk = (daily.time || []).slice(0, 4).map((date, index) => {
          const max = Number(daily.temperature_2m_max?.[index]); const min = Number(daily.temperature_2m_min?.[index])
          const dayRisk = calculateCropRisk({ temperature: Number.isFinite(max) && Number.isFinite(min) ? (max + min) / 2 : current.temperature_2m, humidity: daily.relative_humidity_2m_max?.[index], precipitation: daily.precipitation_sum?.[index], rainProbability: daily.precipitation_probability_max?.[index], windSpeed: daily.wind_speed_10m_max?.[index] }, context)
          return { date, offsetHours: index * 24, score: dayRisk.score, level: dayRisk.level, drivers: dayRisk.factors.slice(0, 3) }
        })
        data = { ...risk, forecastRisk, scouting: buildScoutingMission(risk, context), crop: context, location: { name: farm.location, village: farm.village, taluka: farm.taluka, district: farm.district, latitude, longitude, source: farm.locationSource || 'device_gps', weatherGridLatitude: payload.latitude, weatherGridLongitude: payload.longitude }, current: { temperature: current.temperature_2m, feelsLike: current.apparent_temperature, humidity: current.relative_humidity_2m, precipitation: current.precipitation, windSpeed: current.wind_speed_10m, weatherCode: current.weather_code }, forecast, timezone: payload.timezone, source: 'open-meteo-client', generatedAt: new Date().toISOString(), disclaimer: 'Forecasted crop-health risk is a decision-support estimate from weather and saved farm context, not a prediction that disease or pests will occur. Field sensors and observations may differ.' }
      }
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data })) } catch { /* Storage may be unavailable in private mode. */ }
      return result(data)
    } catch (error) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
        if (cached?.data && Number.isFinite(cached.savedAt)) return result({ ...cached.data, cached: true, cacheAgeHours: Math.max(0, (Date.now() - cached.savedAt) / 3600000) })
      } catch { localStorage.removeItem(cacheKey) }
      throw error
    }
  },
}
export const notificationApi = {
  enable: async (locale = 'en') => {
    if (!('Notification' in window)) throw new Error('Push notifications are not supported by this browser.')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notification permission was not granted.')
    const messaging = await getMessagingSafely()
    if (!messaging) throw new Error('Firebase Messaging is unavailable.')
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token) throw new Error('A push token could not be created.')
    return result((await call('registerPushToken')({ token, locale, enabled: true })).data)
  },
}
