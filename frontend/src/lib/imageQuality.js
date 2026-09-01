const MIN_DIMENSION = 320
const RECOMMENDED_DIMENSION = 720

function guidanceFor(code, metrics = {}) {
  if (code === 'IMAGE_TOO_SMALL') return `Move closer and retake the photo. The image is ${metrics.width}×${metrics.height}; at least ${MIN_DIMENSION}×${MIN_DIMENSION} is required.`
  if (code === 'IMAGE_TOO_DARK') return 'The photo is too dark. Face the plant toward daylight or turn on a steady light, then retake it.'
  if (code === 'IMAGE_TOO_BRIGHT') return 'The photo is overexposed. Move out of harsh sunlight and retake it without flash glare.'
  if (code === 'IMAGE_BLURRY') return 'The photo is blurry. Clean the lens, hold the phone steady, tap the affected area to focus, and retake it.'
  if (code === 'IMAGE_LOW_DETAIL') return 'The photo may not show enough detail. Move closer and keep the affected area in the centre.'
  return 'Photo quality could not be checked on this device. You can retake it or continue; the secure server will check it again.'
}

export function classifyImageQuality(metrics) {
  const { width, height, brightness, contrast, sharpness } = metrics
  if (Math.min(width, height) < MIN_DIMENSION) return { level: 'reject', code: 'IMAGE_TOO_SMALL', guidance: guidanceFor('IMAGE_TOO_SMALL', metrics), metrics }
  if (brightness < 35) return { level: 'reject', code: 'IMAGE_TOO_DARK', guidance: guidanceFor('IMAGE_TOO_DARK', metrics), metrics }
  if (brightness > 240) return { level: 'reject', code: 'IMAGE_TOO_BRIGHT', guidance: guidanceFor('IMAGE_TOO_BRIGHT', metrics), metrics }
  if (sharpness < 6) return { level: 'reject', code: 'IMAGE_BLURRY', guidance: guidanceFor('IMAGE_BLURRY', metrics), metrics }
  if (Math.min(width, height) < RECOMMENDED_DIMENSION || sharpness < 10 || contrast < 18) {
    return { level: 'warning', code: 'IMAGE_LOW_DETAIL', guidance: guidanceFor('IMAGE_LOW_DETAIL', metrics), metrics }
  }
  return { level: 'good', code: 'IMAGE_QUALITY_OK', guidance: 'Photo quality looks usable. The server will verify it again before diagnosis.', metrics }
}

async function loadImage(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function assessImageQuality(file) {
  try {
    const image = await loadImage(file)
    const width = image.width
    const height = image.height
    const scale = Math.min(1, 512 / Math.max(width, height))
    const sampleWidth = Math.max(1, Math.round(width * scale))
    const sampleHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = sampleWidth
    canvas.height = sampleHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight)
    if (typeof image.close === 'function') image.close()
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data
    const grayscale = new Float32Array(sampleWidth * sampleHeight)
    let sum = 0
    for (let pixel = 0, index = 0; pixel < pixels.length; pixel += 4, index += 1) {
      const value = 0.299 * pixels[pixel] + 0.587 * pixels[pixel + 1] + 0.114 * pixels[pixel + 2]
      grayscale[index] = value
      sum += value
    }
    const brightness = sum / grayscale.length
    let variance = 0
    let edgeSum = 0
    let edgeCount = 0
    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const index = y * sampleWidth + x
        const delta = grayscale[index] - brightness
        variance += delta * delta
        if (x > 0) { edgeSum += Math.abs(grayscale[index] - grayscale[index - 1]); edgeCount += 1 }
        if (y > 0) { edgeSum += Math.abs(grayscale[index] - grayscale[index - sampleWidth]); edgeCount += 1 }
      }
    }
    return classifyImageQuality({
      width,
      height,
      brightness: Math.round(brightness * 10) / 10,
      contrast: Math.round(Math.sqrt(variance / grayscale.length) * 10) / 10,
      sharpness: Math.round((edgeSum / Math.max(edgeCount, 1)) * 10) / 10,
    })
  } catch {
    return { level: 'warning', code: 'QUALITY_CHECK_UNAVAILABLE', guidance: guidanceFor('QUALITY_CHECK_UNAVAILABLE'), metrics: null }
  }
}
