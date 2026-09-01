import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScoutingMission, calculateCropRisk, riskLevel } from '../src/lib/riskEngine.js'

test('wet humid conditions raise disease and overall risk', () => {
  const dry = calculateCropRisk({ temperature: 25, humidity: 40, precipitation: 0, rainProbability: 5, windSpeed: 15 }, { cropKey: 'tomato' })
  const wet = calculateCropRisk({ temperature: 27, humidity: 92, precipitation: 24, rainProbability: 90, windSpeed: 3 }, { cropKey: 'tomato', growthStage: 'flowering' })
  assert.ok(wet.scores.disease > dry.scores.disease)
  assert.ok(wet.score > dry.score)
  assert.equal(wet.level, 'critical')
})

test('client risk engine safely handles malformed weather values', () => {
  const result = calculateCropRisk({ temperature: Number.NaN, humidity: null, precipitation: undefined })
  assert.ok(Number.isFinite(result.score))
  assert.equal(riskLevel(result.score), result.level)
  Object.values(result.scores).forEach((score) => assert.ok(score >= 0 && score <= 100))
})

test('scouting mission gives safe, actionable guidance', () => {
  const result = calculateCropRisk({ temperature: 29, humidity: 65, precipitation: 0 }, { cropKey: 'cotton' })
  const mission = buildScoutingMission(result, { cropKey: 'cotton' })
  assert.ok(mission.inspect.length >= 3)
  assert.match(mission.action, /expert confirmation/i)
})
