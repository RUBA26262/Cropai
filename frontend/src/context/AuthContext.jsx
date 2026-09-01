import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier, createUserWithEmailAndPassword, getMultiFactorResolver, multiFactor, onAuthStateChanged, reload, sendEmailVerification, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, firebaseConfigured, firebaseConfigurationError } from '../lib/firebase'

const AuthContext = createContext(null)
const VERIFICATION_COOLDOWN_MS = 60_000
const verificationSentKey = (uid) => `cropai_verification_sent_${uid}`

function authError(error, fallback) {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/weak-password': 'Use a stronger password with at least 8 characters, uppercase, lowercase and a number.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-disabled': 'This account has been disabled. Contact support.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'The network request failed. Check your connection and retry.',
  }
  return new Error(messages[error?.code] || error?.message || fallback)
}

function sessionUser(firebaseUser, profile, token) {
  const role = token.claims.role || profile.role || 'farmer'
  return {
    ...profile,
    uid: firebaseUser.uid,
    id: firebaseUser.uid,
    name: profile.fullName || profile.displayName || firebaseUser.displayName || firebaseUser.email,
    phone: profile.phone || null,
    email: firebaseUser.email,
    role,
    emailVerified: firebaseUser.emailVerified,
    expertVerified: token.claims.expertVerified === true,
    language: profile.preferredLanguage || profile.language || 'en',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mfaState, setMfaState] = useState(null)
  const [mfaEnrollment, setMfaEnrollment] = useState(null)

  useEffect(() => {
    if (!firebaseConfigured) { setLoading(false); return undefined }
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) { setUser(null); setLoading(false); return }
      try {
        const token = await firebaseUser.getIdTokenResult(true)
        const profileRef = doc(db, 'users', firebaseUser.uid)
        const profileSnapshot = await getDoc(profileRef)
        let profile = profileSnapshot.exists() ? profileSnapshot.data() : {}
        const role = token.claims.role || 'farmer'

        // Privileged accounts are provisioned separately and may not have a
        // profile yet. Farmer registration creates its complete profile itself.
        if (!profileSnapshot.exists() && firebaseUser.email && role !== 'farmer') {
          profile = {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            phone: null,
            email: firebaseUser.email,
            district: 'Not set',
            preferredLanguage: 'en',
            language: 'en',
            role,
            emailVerified: firebaseUser.emailVerified,
            privacyConsent: false,
            modelImprovementConsent: false,
            modelTrainingConsent: false,
            theme: 'system',
            consentVersion: '2026-08-31-v1',
            accountStatus: 'active',
            expertVerificationStatus: 'not_requested',
          }
          await setDoc(profileRef, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
        }
        setUser(sessionUser(firebaseUser, profile, token))
      } catch (error) {
        console.error('Unable to load the authenticated profile.', error)
        setUser(null)
      } finally { setLoading(false) }
    }, () => setLoading(false))
  }, [])

  const registerFarmer = async (profile) => {
    if (firebaseConfigurationError) throw new Error(firebaseConfigurationError)
    try {
      const credential = await createUserWithEmailAndPassword(auth, profile.email.trim(), profile.password)
      const firebaseUser = credential.user
      await updateProfile(firebaseUser, { displayName: profile.fullName.trim() })
      const farmerProfile = {
        uid: firebaseUser.uid,
        fullName: profile.fullName.trim(),
        displayName: profile.fullName.trim(),
        phone: profile.phone.trim(),
        email: firebaseUser.email,
        district: profile.district.trim(),
        preferredLanguage: profile.preferredLanguage,
        language: profile.preferredLanguage,
        role: 'farmer',
        emailVerified: false,
        privacyConsent: profile.privacyConsent === true,
        modelImprovementConsent: profile.modelImprovementConsent === true,
        modelTrainingConsent: profile.modelImprovementConsent === true,
        theme: 'system',
        consentVersion: '2026-08-31-v1',
        accountStatus: 'active',
        expertVerificationStatus: 'not_requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', firebaseUser.uid), farmerProfile)
      await sendEmailVerification(firebaseUser)
      sessionStorage.setItem(verificationSentKey(firebaseUser.uid), String(Date.now()))
      const token = await firebaseUser.getIdTokenResult(true)
      setUser(sessionUser(firebaseUser, farmerProfile, token))
      return firebaseUser
    } catch (error) {
      throw authError(error, 'Farmer account creation failed. Please retry.')
    }
  }

  const loginWithEmail = async (email, password, containerId = 'privileged-recaptcha-container') => {
    if (firebaseConfigurationError) throw new Error(firebaseConfigurationError)
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const token = await credential.user.getIdTokenResult(true)
      return { mfaRequired: false, emailVerified: credential.user.emailVerified, role: token.claims.role || 'farmer' }
    } catch (error) {
      if (error.code !== 'auth/multi-factor-auth-required') throw authError(error, 'Sign-in failed. Please retry.')
      const resolver = getMultiFactorResolver(auth, error)
      const hint = resolver.hints[0]
      if (!hint) throw new Error('No approved MFA factor is enrolled.')
      if (window.cropaiRecaptcha) window.cropaiRecaptcha.clear()
      window.cropaiRecaptcha = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
      const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber({ multiFactorHint: hint, session: resolver.session }, window.cropaiRecaptcha)
      setMfaState({ resolver, verificationId })
      return { mfaRequired: true }
    }
  }

  const verifyEmailMfa = async (code) => {
    if (!mfaState) throw new Error('MFA session expired.')
    const credential = PhoneAuthProvider.credential(mfaState.verificationId, code)
    const result = await mfaState.resolver.resolveSignIn(PhoneMultiFactorGenerator.assertion(credential))
    setMfaState(null)
    const token = await result.user.getIdTokenResult(true)
    return { emailVerified: result.user.emailVerified, role: token.claims.role || 'farmer' }
  }

  const refreshEmailVerification = async () => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) throw new Error('Your session expired. Sign in again.')
    await reload(firebaseUser)
    if (!firebaseUser.emailVerified) return false
    await firebaseUser.getIdToken(true)
    await updateDoc(doc(db, 'users', firebaseUser.uid), { emailVerified: true, updatedAt: serverTimestamp() })
    const token = await firebaseUser.getIdTokenResult()
    const profile = await getDoc(doc(db, 'users', firebaseUser.uid))
    setUser(sessionUser(firebaseUser, profile.exists() ? profile.data() : {}, token))
    return true
  }

  const resendVerificationEmail = async () => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) throw new Error('Your session expired. Sign in again.')
    if (firebaseUser.emailVerified) return 0
    const lastSentAt = Number(sessionStorage.getItem(verificationSentKey(firebaseUser.uid)) || 0)
    const remaining = VERIFICATION_COOLDOWN_MS - (Date.now() - lastSentAt)
    if (remaining > 0) return Math.ceil(remaining / 1000)
    try {
      await sendEmailVerification(firebaseUser)
      sessionStorage.setItem(verificationSentKey(firebaseUser.uid), String(Date.now()))
      return VERIFICATION_COOLDOWN_MS / 1000
    } catch (error) {
      throw authError(error, 'The verification email could not be sent. Please retry.')
    }
  }

  const verificationCooldown = () => {
    if (!auth.currentUser) return 0
    const lastSentAt = Number(sessionStorage.getItem(verificationSentKey(auth.currentUser.uid)) || 0)
    return Math.max(0, Math.ceil((VERIFICATION_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000))
  }

  const startMfaEnrollment = async (phone, containerId = 'mfa-enrollment-recaptcha') => {
    if (!auth.currentUser?.email) throw new Error('MFA enrollment requires a verified email account.')
    if (!auth.currentUser.emailVerified) throw new Error('Verify the account email before enrolling MFA.')
    if (window.cropaiMfaRecaptcha) window.cropaiMfaRecaptcha.clear()
    window.cropaiMfaRecaptcha = new RecaptchaVerifier(auth, containerId, { size: 'invisible' })
    const session = await multiFactor(auth.currentUser).getSession()
    const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber({ phoneNumber: phone, session }, window.cropaiMfaRecaptcha)
    setMfaEnrollment({ verificationId })
  }

  const completeMfaEnrollment = async (code) => {
    if (!mfaEnrollment) throw new Error('MFA enrollment session expired.')
    const credential = PhoneAuthProvider.credential(mfaEnrollment.verificationId, code)
    await multiFactor(auth.currentUser).enroll(PhoneMultiFactorGenerator.assertion(credential), 'CropAI privileged account')
    setMfaEnrollment(null)
  }

  const logout = () => signOut(auth)
  const value = useMemo(() => ({
    user, loading, registerFarmer, loginWithEmail, verifyEmailMfa,
    refreshEmailVerification, resendVerificationEmail, verificationCooldown,
    startMfaEnrollment, completeMfaEnrollment, logout,
  }), [user, loading, mfaState, mfaEnrollment])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
