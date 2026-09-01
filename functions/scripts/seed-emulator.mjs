import process from 'node:process'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith('127.0.0.1:') || !process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) {
  throw new Error('Refusing to run: both Auth and Firestore emulator hosts must point to 127.0.0.1.')
}
const projectId = process.env.GCLOUD_PROJECT || 'cropai-dev'
initializeApp({ projectId })
const auth = getAuth(); const db = getFirestore()
const users = [
  { email: 'farmer@cropai.local', role: 'farmer', expertVerified: false, name: 'Local Farmer' },
  { email: 'expert@cropai.local', role: 'expert', expertVerified: true, name: 'Local Expert' },
  { email: 'admin@cropai.local', role: 'admin', expertVerified: false, name: 'Local Admin' },
]
for (const item of users) {
  let user
  try { user = await auth.getUserByEmail(item.email) }
  catch { user = await auth.createUser({ email: item.email, password: 'LocalOnly!12345', emailVerified: true, displayName: item.name }) }
  await auth.setCustomUserClaims(user.uid, { role: item.role, active: true, expertVerified: item.expertVerified })
  await db.doc(`users/${user.uid}`).set({ displayName: item.name, language: 'en', theme: 'system', district: 'Pune', consentVersion: 'emulator-only', modelTrainingConsent: false, accountStatus: 'active', expertVerificationStatus: item.expertVerified ? 'approved' : 'not_requested', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
}
console.log('Created local-only accounts with password LocalOnly!12345')
console.log(users.map((item) => `${item.role}: ${item.email}`).join('\n'))
