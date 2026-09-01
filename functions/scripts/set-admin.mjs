import process from 'node:process'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [uid, confirmation] = process.argv.slice(2)
if (!uid || confirmation !== 'I_UNDERSTAND_THIS_GRANTS_ADMIN') {
  console.error('Usage: node scripts/set-admin.mjs <firebase-uid> I_UNDERSTAND_THIS_GRANTS_ADMIN')
  process.exit(1)
}
initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT })
const auth = getAuth()
const user = await auth.getUser(uid)
if (!user.emailVerified || !user.multiFactor?.enrolledFactors?.length) {
  throw new Error('Admin bootstrap requires verified email and an enrolled MFA factor.')
}
await auth.setCustomUserClaims(uid, { ...user.customClaims, role: 'admin', active: true, expertVerified: false })
console.log(`Admin claim set for ${uid}. Re-authentication is required.`)
