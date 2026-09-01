import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API = 'http://115.124.105.220/API'
const OUTPUT = new URL('../frontend/public/location/', import.meta.url)
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const localOrEnglish = (localValue, englishValue) => String(localValue || '').trim() || String(englishValue || '').trim()

async function request(path, attempt = 1) {
  try {
    const response = await fetch(`${API}${path}`, { method: 'POST', signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('Directory response is not an array')
    return data
  } catch (error) {
    if (attempt >= 4) throw new Error(`${path} failed after ${attempt} attempts: ${error.message}`)
    await pause(500 * 2 ** (attempt - 1))
    return request(path, attempt + 1)
  }
}

function unique(items, label) {
  const codes = items.map((item) => item.code)
  if (new Set(codes).size !== codes.length) throw new Error(`Duplicate ${label} code detected`)
}

async function mapLimit(items, limit, work) {
  const output = new Array(items.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await work(items[index], index)
    }
  }))
  return output
}

const rawDistricts = await request('/GetAllDistricts')
const districts = rawDistricts.map((item) => ({
  code: String(item.districtcode).trim(),
  name: String(item.districtnameenglish).trim(),
  localName: localOrEnglish(item.districtlocalname, item.districtnameenglish),
}))
if (districts.length !== 36) throw new Error(`Expected 36 Maharashtra districts; received ${districts.length}`)
unique(districts, 'district')

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(new URL('./districts/', OUTPUT), { recursive: true })

let talukaTotal = 0
let villageTotal = 0
const summaries = await mapLimit(districts, 3, async (district) => {
  const rawTalukas = await request(`/GetTalukasOfDistrict?distcode=${encodeURIComponent(district.code)}`)
  const talukas = await mapLimit(rawTalukas, 4, async (taluka) => {
    const code = String(taluka.subdistrictcode).trim()
    if (String(taluka.districtcode).trim() !== district.code) throw new Error(`Taluka ${code} has the wrong district parent`)
    const rawVillages = await request(`/GetVillagesOfDistrictAndTaluka?distcode=${encodeURIComponent(district.code)}&talukacode=${encodeURIComponent(code)}`)
    const villages = rawVillages.map((village) => ({
      code: String(village.villagecode).trim(),
      name: String(village.villagenameenglish).trim(),
      localName: localOrEnglish(village.villagelocalname, village.villagenameenglish),
      lgdCode: String(village.lgd_code || '').trim() || undefined,
    })).filter((village) => village.code && village.name)
    unique(villages, `village in taluka ${code}`)
    villageTotal += villages.length
    return {
      code,
      name: String(taluka.subdistrictnameenglish).trim(),
      localName: localOrEnglish(taluka.subdistrictlocalname, taluka.subdistrictnameenglish),
      villages,
    }
  })
  unique(talukas, `taluka in district ${district.code}`)
  talukaTotal += talukas.length
  const payload = { district, talukas }
  await writeFile(new URL(`./districts/${district.code}.json`, OUTPUT), `${JSON.stringify(payload)}\n`, 'utf8')
  return { ...district, talukaCount: talukas.length, villageCount: talukas.reduce((sum, item) => sum + item.villages.length, 0) }
})

const generatedAt = new Date().toISOString()
const manifest = { state: 'Maharashtra', generatedAt, source: API, districtCount: districts.length, talukaCount: talukaTotal, villageCount: villageTotal, districts: summaries }
await writeFile(new URL('./manifest.json', OUTPUT), `${JSON.stringify(manifest)}\n`, 'utf8')
await writeFile(new URL('./README.txt', OUTPUT), `Generated from the Maharashtra Common Village Master API.\nGenerated: ${generatedAt}\nDistricts: ${districts.length}\nTalukas: ${talukaTotal}\nVillages: ${villageTotal}\n`, 'utf8')
console.log(`Location hierarchy written: ${districts.length} districts, ${talukaTotal} talukas, ${villageTotal} villages.`)
