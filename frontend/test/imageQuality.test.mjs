import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyImageQuality } from '../src/lib/imageQuality.js'

const base = { width: 1280, height: 960, brightness: 120, contrast: 42, sharpness: 18 }

test('accepts a clear, evenly lit phone photo', () => {
  assert.equal(classifyImageQuality(base).level, 'good')
})

test('rejects an undersized photo', () => {
  assert.deepEqual(classifyImageQuality({ ...base, width: 240 }).code, 'IMAGE_TOO_SMALL')
})

test('rejects dark and blurry photos with retake guidance', () => {
  const dark = classifyImageQuality({ ...base, brightness: 20 })
  const blurry = classifyImageQuality({ ...base, sharpness: 3 })
  assert.equal(dark.code, 'IMAGE_TOO_DARK')
  assert.match(dark.guidance, /daylight/i)
  assert.equal(blurry.code, 'IMAGE_BLURRY')
  assert.match(blurry.guidance, /steady/i)
})

test('warns rather than rejects when detail is marginal', () => {
  assert.equal(classifyImageQuality({ ...base, width: 640 }).level, 'warning')
})
