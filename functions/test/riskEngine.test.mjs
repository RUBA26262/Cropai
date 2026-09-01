import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScoutingMission, calculateCropRisk, riskLevel } from '../lib/riskEngine.js'
import { MAHARASHTRA_DISTRICTS } from '../lib/locationFallback.js'

test('wet humid conditions raise disease and overall risk', () => {
  const dry = calculateCropRisk({ temperature: 25, humidity: 40, precipitation: 0, rainProbability: 5, windSpeed: 15 }, { cropKey: 'tomato' })
  const wet = calculateCropRisk({ temperature: 27, humidity: 92, precipitation: 24, rainProbability: 90, windSpeed: 3 }, { cropKey: 'tomato', growthStage: 'flowering' })
  assert.ok(wet.scores.disease > dry.scores.disease)
  assert.ok(wet.score > dry.score)
  assert.equal(wet.level, 'critical')
})

test('extreme dry heat raises water-stress without invalid scores', () => {
  const result = calculateCropRisk({ temperature: 42, humidity: 20, precipitation: 0, rainProbability: 0 }, { irrigationType: 'Rain-fed' })
  assert.ok(result.scores.waterStress >= 80)
  Object.values(result.scores).forEach((score) => assert.ok(score >= 0 && score <= 100))
})

test('missing and malformed weather values degrade safely', () => {
  const result = calculateCropRisk({ temperature: Number.NaN, humidity: null, precipitation: undefined })
  assert.ok(Number.isFinite(result.score))
  assert.equal(riskLevel(result.score), result.level)
})

test('scouting mission uses the dominant risk and safe treatment language', () => {
  const result = calculateCropRisk({ temperature: 29, humidity: 65, precipitation: 0 }, { cropKey: 'cotton' })
  const mission = buildScoutingMission(result, { cropKey: 'cotton' })
  assert.ok(mission.inspect.length >= 3)
  assert.match(mission.action, /expert confirmation/i)
})

test('bundled Maharashtra district fallback is complete and unique', () => {
  assert.equal(MAHARASHTRA_DISTRICTS.length, 36)
  assert.equal(new Set(MAHARASHTRA_DISTRICTS.map((item) => item.code)).size, 36)
  assert.ok(MAHARASHTRA_DISTRICTS.some((item) => item.name === 'Pune'))
  assert.ok(MAHARASHTRA_DISTRICTS.some((item) => item.name === 'Ahilyanagar'))
})
