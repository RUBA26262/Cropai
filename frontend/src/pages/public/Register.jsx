import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const initialForm = {
  fullName: '', phone: '+91', email: '', district: '', preferredLanguage: 'mr',
  password: '', confirmPassword: '', privacyConsent: false, modelImprovementConsent: false,
}

export default function Register() {
  const { registerFarmer } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const validate = () => {
    if (form.fullName.trim().length < 2) return 'Enter your full name.'
    if (!/^\+?[0-9 ()-]{10,20}$/.test(form.phone.trim())) return 'Enter a valid mobile number, including the country code.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.'
    if (!form.district.trim()) return 'Enter your district.'
    if (form.password.length < 8 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
      return 'Password must contain at least 8 characters, including uppercase, lowercase and a number.'
    }
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    if (!form.privacyConsent) return 'Accept the privacy notice to create an account.'
    return null
  }

  const submit = async (event) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setLoading(true); setError('')
    try {
      const firebaseUser = await registerFarmer(form)
      navigate('/verify-email', { replace: true, state: { email: firebaseUser.email } })
    } catch (reason) { setError(reason.message || 'Registration failed.') }
    finally { setLoading(false) }
  }

  return <div className="page-shell max-w-lg py-16"><div className="surface p-7">
    <h1 className="text-3xl font-semibold">Farmer registration</h1>
    <p className="muted mt-2">Create a farmer account with your email. Expert access still requires separate credential verification.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="field-label">Full name<input className="field mt-1" autoComplete="name" value={form.fullName} onChange={(event) => set('fullName', event.target.value)} required maxLength={120} /></label>
      <label className="field-label">Mobile number<input className="field mt-1" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} required maxLength={20} placeholder="+91 98765 43210" /><span className="block text-xs muted mt-1">Used only in your farmer profile; your email is used to sign in.</span></label>
      <label className="field-label">Email address<input className="field mt-1" type="email" autoComplete="email" value={form.email} onChange={(event) => set('email', event.target.value)} required maxLength={254} /></label>
      <label className="field-label">District<input className="field mt-1" value={form.district} onChange={(event) => set('district', event.target.value)} required maxLength={120} /></label>
      <label className="field-label">Preferred language<select className="field mt-1" value={form.preferredLanguage} onChange={(event) => set('preferredLanguage', event.target.value)}><option value="mr">मराठी</option><option value="hi">हिन्दी</option><option value="en">English</option></select></label>
      <label className="field-label">Password<input className="field mt-1" type="password" autoComplete="new-password" value={form.password} onChange={(event) => set('password', event.target.value)} required minLength={8} /></label>
      <p className="text-xs muted -mt-2">At least 8 characters with uppercase, lowercase and a number.</p>
      <label className="field-label">Confirm password<input className="field mt-1" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => set('confirmPassword', event.target.value)} required minLength={8} /></label>
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={form.privacyConsent} onChange={(event) => set('privacyConsent', event.target.checked)} required /><span>I accept the privacy notice and consent to processing images for diagnosis.</span></label>
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={form.modelImprovementConsent} onChange={(event) => set('modelImprovementConsent', event.target.checked)} /><span>Optional: allow de-identified crop images to improve future models.</span></label>
      {error && <p className="error-box" role="alert">{error}</p>}
      <button className="primary-button w-full" disabled={loading}>{loading ? 'Creating account…' : 'Create Farmer Account'}</button>
    </form>
    <p className="text-sm muted text-center mt-5">Already registered? <Link className="link" to="/login">Sign in</Link></p>
  </div></div>
}
