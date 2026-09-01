const number = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clamp = (value) => Math.round(Math.max(0, Math.min(100, value)))

export const riskLevel = (score) => score >= 80 ? 'critical' : score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low'

const cropPestBias = new Set(['cotton', 'maize', 'rice', 'chilli', 'tomato', 'onion', 'sugarcane'])
const cropDiseaseBias = new Set(['potato', 'tomato', 'onion', 'grape', 'pomegranate', 'rice', 'soybean'])

export function calculateCropRisk(weather, context = {}) {
  const temperature = number(weather.temperature, 25)
  const humidity = number(weather.humidity, 60)
  const precipitation = Math.max(0, number(weather.precipitation))
  const rainProbability = Math.max(0, number(weather.rainProbability))
  const windSpeed = Math.max(0, number(weather.windSpeed, 8))
  const growthStage = String(context.growthStage || 'unknown').toLowerCase()
  const irrigation = String(context.irrigationType || '').toLowerCase()
  const cropKey = String(context.cropKey || '').toLowerCase()
  const humid = humidity >= 85 ? 30 : humidity >= 75 ? 23 : humidity >= 60 ? 12 : 3
  const wet = precipitation >= 20 ? 25 : precipitation >= 8 ? 20 : precipitation >= 2 ? 12 : 0
  const likelyRain = rainProbability >= 80 ? 15 : rainProbability >= 50 ? 10 : rainProbability >= 25 ? 5 : 0
  const favorableTemperature = temperature >= 20 && temperature <= 30 ? 20 : temperature >= 15 && temperature <= 35 ? 10 : 2
  const stillAir = windSpeed <= 5 ? 10 : windSpeed <= 12 ? 5 : 0
  const weatherScore = clamp(humid + wet + likelyRain + favorableTemperature + stillAir)
  const vulnerableStage = ['flowering', 'fruiting'].includes(growthStage) ? 10 : growthStage === 'seedling' ? 6 : 2
  const diseaseScore = clamp(8 + humid * 1.15 + wet * 1.05 + likelyRain * 0.75 + favorableTemperature * 0.45 + vulnerableStage + (cropDiseaseBias.has(cropKey) ? 7 : 0))
  const pestTemperature = temperature >= 24 && temperature <= 34 ? 24 : temperature >= 18 && temperature <= 38 ? 12 : 4
  const pestScore = clamp(12 + pestTemperature + (humidity >= 55 && humidity <= 85 ? 15 : 5) + stillAir + vulnerableStage + (cropPestBias.has(cropKey) ? 10 : 3))
  const dry = precipitation < 1 && rainProbability < 25 ? 24 : precipitation < 3 ? 12 : 0
  const heat = temperature >= 36 ? 35 : temperature >= 32 ? 22 : temperature >= 29 ? 10 : 2
  const dryAir = humidity < 35 ? 24 : humidity < 50 ? 12 : 2
  const irrigationBuffer = irrigation.includes('drip') || irrigation.includes('sprinkler') ? -12 : irrigation.includes('rain') ? 8 : 0
  const waterStress = clamp(5 + dry + heat + dryAir + irrigationBuffer)
  const overall = clamp(diseaseScore * 0.34 + pestScore * 0.31 + weatherScore * 0.25 + waterStress * 0.10)
  const factors = [
    { key: 'humidity', label: humidity >= 75 ? 'High humidity' : 'Humidity', impact: clamp(humid), detail: `${Math.round(humidity)}% relative humidity` },
    { key: 'rain', label: precipitation >= 8 ? 'Recent / forecast rain' : 'Rainfall', impact: clamp(wet + likelyRain), detail: `${precipitation.toFixed(1)} mm · ${Math.round(rainProbability)}% chance` },
    { key: 'temperature', label: 'Temperature', impact: clamp(Math.max(favorableTemperature, pestTemperature)), detail: `${temperature.toFixed(1)}°C` },
    { key: 'growth_stage', label: 'Crop growth stage', impact: vulnerableStage, detail: growthStage === 'unknown' ? 'Not recorded' : growthStage },
    { key: 'crop_context', label: 'Crop susceptibility context', impact: cropPestBias.has(cropKey) || cropDiseaseBias.has(cropKey) ? 10 : 3, detail: cropKey || 'Crop not recorded' },
  ].sort((a, b) => b.impact - a.impact)
  return { score: overall, level: riskLevel(overall), scores: { disease: diseaseScore, pest: pestScore, weather: weatherScore, waterStress, overall }, factors }
}

export function buildScoutingMission(result, context = {}) {
  const pest = result.scores.pest >= result.scores.disease
  const urgency = result.score >= 80 ? 'today' : result.score >= 65 ? 'within 24 hours' : result.score >= 35 ? 'within 3 days' : 'during the next routine field visit'
  return {
    urgency,
    headline: pest ? 'Inspect for early pest pressure' : 'Inspect for early disease symptoms',
    inspect: pest ? ['Field edges and plants near weeds', 'Lower leaf surfaces and new shoots', 'Damaged stems, buds and fruiting parts'] : ['Lower and inner leaves', 'Dense or poorly ventilated patches', 'Plants near standing water or irrigation lines'],
    capture: ['One close-up of the affected area', 'One whole-plant view', 'One wider field-context view'],
    questions: pest ? ['Are holes, mines, webbing or sticky residue visible?', 'Are insects, eggs or droppings visible?', 'Is damage increasing across nearby plants?'] : ['Are spots, lesions, mould or yellowing visible?', 'Are symptoms spreading from lower leaves?', 'Is the affected patch growing after rain or irrigation?'],
    action: `Scout ${urgency}. Record observations before choosing treatment; request expert confirmation before chemical control.`,
    cropKey: context.cropKey || 'unknown',
  }
}
