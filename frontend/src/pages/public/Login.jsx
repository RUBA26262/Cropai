import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const destinationFor = (role) => role === 'admin' ? '/admin' : role === 'expert' ? '/expert' : '/dashboard'

export default function Login() {
  const { loginWithEmail, verifyEmailMfa } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('farmer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const changeMode = (value) => {
    setMode(value); setMfaRequired(false); setMfaCode(''); setError('')
  }

  const continueAfterAuthentication = (result) => {
    if ((result.role || 'farmer') === 'farmer' && !result.emailVerified) {
      navigate('/verify-email', { replace: true, state: { email } })
      return
    }
    navigate(destinationFor(result.role), { replace: true })
  }

  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('')
    try {
      if (!mfaRequired) {
        const result = await loginWithEmail(email, password)
        if (result.mfaRequired) setMfaRequired(true)
        else continueAfterAuthentication(result)
      } else {
        const result = await verifyEmailMfa(mfaCode)
        continueAfterAuthentication(result)
      }
    } catch (reason) { setError(reason.message || 'Sign-in failed. Please retry.') }
    finally { setLoading(false) }
  }

  return <div className="page-shell max-w-md py-16">
    <div className="surface p-7">
      <h1 className="text-3xl font-semibold">Secure sign in</h1>
      <p className="muted mt-2">Farmers sign in with a verified email. Experts and administrators retain protected email and MFA access.</p>
      <div className="grid grid-cols-2 gap-2 mt-6 p-1 rounded-xl bg-[var(--surface-muted)]">
        <button type="button" className={`tab-button ${mode === 'farmer' ? 'active' : ''}`} onClick={() => changeMode('farmer')}><Mail className="w-4 h-4" /> Farmer</button>
        <button type="button" className={`tab-button ${mode === 'privileged' ? 'active' : ''}`} onClick={() => changeMode('privileged')}><ShieldCheck className="w-4 h-4" /> Expert / Admin</button>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="field-label">Email address<input className="field mt-1" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={mfaRequired} /></label>
        <label className="field-label">Password<input className="field mt-1" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={mfaRequired} /></label>
        {mfaRequired && <label className="field-label">MFA code<input className="field mt-1" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))} required /></label>}
        {mode === 'privileged' && <p className="text-xs muted">Multi-factor authentication remains enforced for privileged accounts in Firebase Identity Platform.</p>}
        {mode === 'farmer' && <p className="text-xs muted">Your email must be verified before farmer dashboard access is allowed.</p>}
        {error && <p className="error-box" role="alert">{error}</p>}
        <button className="primary-button w-full" disabled={loading}>{loading ? 'Signing in…' : mfaRequired ? 'Verify MFA and sign in' : 'Sign in'}</button>
      </form>
      <div id="privileged-recaptcha-container" />
      {mode === 'farmer' && <p className="text-sm muted text-center mt-5">New farmer? <Link className="link" to="/register">Create an account</Link></p>}
    </div>
  </div>
}
