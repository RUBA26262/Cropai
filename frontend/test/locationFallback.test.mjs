import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { MAHARASHTRA_DISTRICTS } from '../src/lib/locationFallback.js'

test('bundled district selector fallback contains the current 36 Maharashtra districts', () => {
  assert.equal(MAHARASHTRA_DISTRICTS.length, 36)
  assert.equal(new Set(MAHARASHTRA_DISTRICTS.map((item) => item.code)).size, 36)
  assert.deepEqual(
    MAHARASHTRA_DISTRICTS.filter((item) => ['Ahilyanagar', 'Chhatrapati Sambhajinagar', 'Dharashiv'].includes(item.name)).map((item) => item.name),
    ['Ahilyanagar', 'Chhatrapati Sambhajinagar', 'Dharashiv'],
  )
})

test('generated hierarchy contains every declared taluka and village with valid parent codes', async () => {
  const root = new URL('../public/location/', import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'))
  assert.equal(manifest.districtCount, 36)
  assert.equal(manifest.talukaCount, 358)
  assert.equal(manifest.villageCount, 44911)
  let talukas = 0
  let villages = 0
  for (const summary of manifest.districts) {
    const payload = JSON.parse(await readFile(new URL(`districts/${summary.code}.json`, root), 'utf8'))
    assert.equal(payload.district.code, summary.code)
    assert.equal(new Set(payload.talukas.map((item) => item.code)).size, payload.talukas.length)
    talukas += payload.talukas.length
    for (const taluka of payload.talukas) {
      assert.equal(new Set(taluka.villages.map((item) => item.code)).size, taluka.villages.length)
      assert.ok(taluka.villages.every((item) => item.name && item.localName))
      villages += taluka.villages.length
    }
  }
  assert.equal(talukas, manifest.talukaCount)
  assert.equal(villages, manifest.villageCount)
})
