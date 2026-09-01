import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
}

// Emulator connections are deliberately development-only. A stale environment
// variable must never make a deployed build send user data to localhost.
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
const requiredConfig = Object.entries(firebaseConfig).filter(([key]) => key !== 'measurementId')
const invalidValue = (value) => !value || /^(demo|replace|your[-_])/i.test(value) || /000000000000/.test(value)
const missing = requiredConfig.filter(([, value]) => invalidValue(value)).map(([key]) => key)
export const firebaseConfigured = missing.length === 0 || useEmulators
export const firebaseConfigurationError = firebaseConfigured ? null : `Missing or placeholder Firebase settings: ${missing.join(', ')}. Copy frontend/.env.example to frontend/.env and paste the Firebase web app configuration.`
const app = initializeApp(useEmulators || missing.length === 0 ? firebaseConfig : {
  apiKey: 'demo-key', authDomain: 'demo.local', projectId: 'cropai-demo',
  storageBucket: 'cropai-demo.firebasestorage.app', messagingSenderId: '0', appId: 'demo-app',
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_REGION || 'asia-south1')
export const storage = getStorage(app)

if (!useEmulators && missing.length === 0 && import.meta.env.VITE_FIREBASE_APPCHECK_KEY) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APPCHECK_KEY), isTokenAutoRefreshEnabled: true })
}

if (useEmulators && !globalThis.__cropaiEmulatorsConnected) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
  globalThis.__cropaiEmulatorsConnected = true
}

export const getMessagingSafely = async () => (firebaseConfigured && await isSupported() ? getMessaging(app) : null)
