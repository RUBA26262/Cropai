import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'

let env
const farmer = { uid: 'farmer_aaaaaaaaaaaa', role: 'farmer', active: true, expertVerified: false }
const farmerB = { uid: 'farmer_bbbbbbbbbbbb', role: 'farmer', active: true, expertVerified: false }
const expert = { uid: 'expert_aaaaaaaaaaaa', role: 'expert', active: true, expertVerified: true }
const admin = { uid: 'admin_aaaaaaaaaaaaa', role: 'admin', active: true }
const claims = ({ uid: _uid, ...token }) => token

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'cropai-test',
    firestore: { rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8280 },
    storage: { rules: await readFile(new URL('../../storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9499 },
  })
})
after(async () => env?.cleanup())
beforeEach(async () => env.clearFirestore())

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'farms', 'farm_aaaaaaaaaaaa'), { ownerUid: farmer.uid, name: 'Farm A', district: 'Pune', createdAt: new Date() })
    await setDoc(doc(db, 'farmCrops', 'crop_aaaaaaaaaaaa'), { ownerUid: farmer.uid, farmId: 'farm_aaaaaaaaaaaa', cropKey: 'tomato', status: 'active', createdAt: new Date() })
    await setDoc(doc(db, 'scans', 'scan_aaaaaaaaaaaa'), { ownerUid: farmer.uid, farmId: 'farm_aaaaaaaaaaaa', farmCropId: 'crop_aaaaaaaaaaaa', status: 'uploading', result: null, createdAt: new Date() })
    await setDoc(doc(db, 'alerts', 'alert_aaaaaaaaaaa'), { recipientUid: farmer.uid, read: false, title: 'Private', createdAt: new Date() })
    await setDoc(doc(db, 'expertReviews', `scan_aaaaaaaaaaaa_${expert.uid}`), { ownerUid: farmer.uid, assignedExpertUid: expert.uid, scanId: 'scan_aaaaaaaaaaaa', status: 'assigned' })
    await setDoc(doc(db, 'auditEvents', 'audit_aaaaaaaaaaa'), { actorUid: admin.uid, action: 'test' })
  })
}

const farmerProfile = (uid, email) => ({
  uid,
  fullName: 'Test Farmer',
  displayName: 'Test Farmer',
  phone: '+919876543210',
  email,
  district: 'Pune',
  preferredLanguage: 'mr',
  language: 'mr',
  role: 'farmer',
  emailVerified: false,
  privacyConsent: true,
  modelImprovementConsent: false,
  modelTrainingConsent: false,
  theme: 'system',
  consentVersion: '2026-08-31-v1',
  accountStatus: 'active',
  expertVerificationStatus: 'not_requested',
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('Farmer email profile rules', () => {
  it('allows an authenticated farmer to create only their own profile', async () => {
    const email = 'farmer@example.com'
    const token = claims({ ...farmer, email, email_verified: false })
    await assertSucceeds(setDoc(doc(env.authenticatedContext(farmer.uid, token).firestore(), 'users', farmer.uid), farmerProfile(farmer.uid, email)))
    await assertFails(setDoc(doc(env.authenticatedContext(farmer.uid, token).firestore(), 'users', farmerB.uid), farmerProfile(farmerB.uid, email)))
  })

  it('does not allow a farmer to forge email verification or role', async () => {
    const email = 'farmer@example.com'
    const unverified = claims({ ...farmer, email, email_verified: false })
    const db = env.authenticatedContext(farmer.uid, unverified).firestore()
    await assertSucceeds(setDoc(doc(db, 'users', farmer.uid), farmerProfile(farmer.uid, email)))
    await assertFails(updateDoc(doc(db, 'users', farmer.uid), { emailVerified: true, updatedAt: new Date() }))
    await assertFails(updateDoc(doc(db, 'users', farmer.uid), { role: 'admin', updatedAt: new Date() }))
  })

  it('allows verified Firebase email state to be synchronized', async () => {
    const email = 'farmer@example.com'
    const unverified = claims({ ...farmer, email, email_verified: false })
    await assertSucceeds(setDoc(doc(env.authenticatedContext(farmer.uid, unverified).firestore(), 'users', farmer.uid), farmerProfile(farmer.uid, email)))
    const verified = claims({ ...farmer, email, email_verified: true })
    await assertSucceeds(updateDoc(doc(env.authenticatedContext(farmer.uid, verified).firestore(), 'users', farmer.uid), { emailVerified: true, updatedAt: new Date() }))
  })
})

describe('Firestore tenant isolation', () => {
  it('allows a strictly validated bundled-directory farm but blocks forged locations and location changes', async () => {
    await seed()
    const db = env.authenticatedContext(farmer.uid, claims(farmer)).firestore()
    const validFarm = { ownerUid: farmer.uid, name: 'Bundled farm', district: 'Pune', districtCode: '490', taluka: 'Ambegaon', talukaCode: '4188', village: 'Adivare', villageCode: '555422', villageLgdCode: '274904188555422', location: 'Adivare, Ambegaon, Pune', latitude: 18.9, longitude: 73.7, locationSource: 'device_gps', locationHierarchyVerified: false, locationHierarchySource: 'bundled_official_directory_client', areaAcres: 2, soilType: 'Black soil', irrigationType: 'Drip irrigation', createdAt: new Date(), updatedAt: new Date() }
    await assertSucceeds(setDoc(doc(db, 'farms', 'farm_newaaaaaaaa'), validFarm))
    await assertSucceeds(setDoc(doc(db, 'farms', 'farm_tamilnaduaaa'), { ...validFarm, latitude: 8.73126, longitude: 77.72355 }))
    await assertFails(setDoc(doc(db, 'farms', 'farm_badowneraaaa'), { ...validFarm, ownerUid: farmerB.uid }))
    await assertFails(setDoc(doc(db, 'farms', 'farm_badgpsaaaaa'), { ...validFarm, latitude: 0, longitude: 0 }))
    await assertFails(setDoc(doc(db, 'farms', 'farm_manualaaaaaa'), { ...validFarm, talukaCode: 'manual', locationHierarchySource: 'user_entered_fallback' }))
    await assertFails(setDoc(doc(db, 'farms', 'farm_fakeverifieda'), { ...validFarm, locationHierarchyVerified: true }))
    await assertFails(updateDoc(doc(db, 'farms', 'farm_aaaaaaaaaaaa'), { village: 'Wrong village', updatedAt: new Date() }))
    await assertSucceeds(updateDoc(doc(db, 'farms', 'farm_aaaaaaaaaaaa'), { name: 'Renamed Farm', updatedAt: new Date() }))
  })

  it('denies anonymous and cross-farmer reads', async () => {
    await seed()
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'farms', 'farm_aaaaaaaaaaaa')))
    await assertFails(getDoc(doc(env.authenticatedContext(farmerB.uid, claims(farmerB)).firestore(), 'farms', 'farm_aaaaaaaaaaaa')))
    await assertSucceeds(getDoc(doc(env.authenticatedContext(farmer.uid, claims(farmer)).firestore(), 'farms', 'farm_aaaaaaaaaaaa')))
  })

  it('requires ownership constraints on list queries', async () => {
    await seed()
    const db = env.authenticatedContext(farmer.uid, claims(farmer)).firestore()
    await assertFails(getDocs(collection(db, 'farms')))
    const safe = await assertSucceeds(getDocs(query(collection(db, 'farms'), where('ownerUid', '==', farmer.uid))))
    assert.equal(safe.size, 1)
  })

  it('prevents owners from modifying trusted scan output', async () => {
    await seed()
    const db = env.authenticatedContext(farmer.uid, claims(farmer)).firestore()
    await assertFails(updateDoc(doc(db, 'scans', 'scan_aaaaaaaaaaaa'), { status: 'completed', result: { conditionId: 'fake' } }))
  })

  it('allows only assigned verified experts to read a scan', async () => {
    await seed()
    await assertSucceeds(getDoc(doc(env.authenticatedContext(expert.uid, claims(expert)).firestore(), 'scans', 'scan_aaaaaaaaaaaa')))
    const otherExpert = { uid: 'expert_bbbbbbbbbbbb', role: 'expert', active: true, expertVerified: true }
    await assertFails(getDoc(doc(env.authenticatedContext(otherExpert.uid, claims(otherExpert)).firestore(), 'scans', 'scan_aaaaaaaaaaaa')))
  })

  it('allows alert read acknowledgement but no content tampering', async () => {
    await seed()
    const db = env.authenticatedContext(farmer.uid, claims(farmer)).firestore()
    await assertSucceeds(updateDoc(doc(db, 'alerts', 'alert_aaaaaaaaaaa'), { read: true, readAt: new Date() }))
    await assertFails(updateDoc(doc(db, 'alerts', 'alert_aaaaaaaaaaa'), { title: 'Changed' }))
  })

  it('restricts audit logs to administrators', async () => {
    await seed()
    await assertFails(getDoc(doc(env.authenticatedContext(expert.uid, claims(expert)).firestore(), 'auditEvents', 'audit_aaaaaaaaaaa')))
    await assertSucceeds(getDoc(doc(env.authenticatedContext(admin.uid, claims(admin)).firestore(), 'auditEvents', 'audit_aaaaaaaaaaa')))
  })
})

describe('Storage quarantine rules', () => {
  it('accepts owner image slot and denies cross-user upload', async () => {
    await seed()
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const ownStorage = env.authenticatedContext(farmer.uid, claims(farmer)).storage()
    await assertSucceeds(uploadBytes(ref(ownStorage, `quarantine/${farmer.uid}/scan_aaaaaaaaaaaa/closeup.jpg`), bytes, { contentType: 'image/jpeg' }))
    const otherStorage = env.authenticatedContext(farmerB.uid, claims(farmerB)).storage()
    await assertFails(uploadBytes(ref(otherStorage, `quarantine/${farmer.uid}/scan_aaaaaaaaaaaa/plant.jpg`), bytes, { contentType: 'image/jpeg' }))
  })

  it('denies invalid slot and executable content type', async () => {
    await seed()
    const storage = env.authenticatedContext(farmer.uid, claims(farmer)).storage()
    await assertFails(uploadBytes(ref(storage, `quarantine/${farmer.uid}/scan_aaaaaaaaaaaa/payload.exe`), new Uint8Array([1]), { contentType: 'application/octet-stream' }))
    await assertFails(uploadBytes(ref(storage, `quarantine/${farmer.uid}/scan_aaaaaaaaaaaa/fourth.jpg`), new Uint8Array([1]), { contentType: 'image/jpeg' }))
  })
})
