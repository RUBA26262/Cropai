import { readFile } from 'node:fs/promises'

const envPath = new URL('../.env', import.meta.url)
const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

let source
try {
  source = await readFile(envPath, 'utf8')
} catch {
  console.error('frontend/.env does not exist. Copy frontend/.env.example and add your Firebase web app values.')
  process.exit(1)
}

const values = Object.fromEntries(source
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]
  }))

const invalidValue = (value) => !value || /^(demo|replace|your[-_])/i.test(value) || /000000000000/.test(value)
const invalid = required.filter((key) => invalidValue(values[key]))

if (values.VITE_USE_FIREBASE_EMULATORS === 'true') {
  console.error('VITE_USE_FIREBASE_EMULATORS must be false for an online build.')
  process.exit(1)
}
if (invalid.length) {
  console.error(`Replace the missing/demo Firebase settings in frontend/.env: ${invalid.join(', ')}`)
  process.exit(1)
}
console.log(`Firebase online configuration is ready for project ${values.VITE_FIREBASE_PROJECT_ID}.`)
