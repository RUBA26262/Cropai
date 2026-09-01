import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, LogOut, Mail, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function VerifyEmail() {
  const { user, loading, refreshEmailVerification, resendVerificationEmail, verificationCooldown, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [cooldown, setCooldown] = useState(() => verificationCooldown())
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState('Verification email sent')
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  if (loading) return <div className="min-h-[50vh] grid place-items-center muted">Loading secure session…</div>
  if (!user) return <Navigate to="/login" replace />

  const email = user.email || location.state?.email
  const checkVerification = async () => {
    setChecking(true); setError(''); setMessage('')
    try {
      const verified = await refreshEmailVerification()
      if (verified) navigate('/dashboard', { replace: true })
      else setError('Your email has not been verified yet. Please check your inbox.')
    } catch (reason) { setError(reason.message || 'Verification status could not be checked.') }
    finally { setChecking(false) }
  }

  const resend = async () => {
    setResending(true); setError('')
    try {
      const seconds = await resendVerificationEmail()
      setCooldown(seconds)
      setMessage(seconds === 0 ? 'Your email is already verified.' : 'A new verification email has been sent.')
    } catch (reason) { setError(reason.message || 'Verification email could not be sent.') }
    finally { setResending(false) }
  }

  const signOutNow = async () => { await logout(); navigate('/', { replace: true }) }

  return <div className="page-shell max-w-lg py-16"><div className="surface p-7 text-center">
    <div className="w-14 h-14 rounded-full bg-[var(--surface-muted)] text-[var(--primary)] grid place-items-center mx-auto"><Mail className="w-7 h-7" /></div>
    <h1 className="text-3xl font-semibold mt-5">Verification email sent</h1>
    <p className="muted mt-3">We sent a verification link to:</p>
    <p className="font-semibold break-all mt-1">{email}</p>
    <p className="muted mt-4">Please verify your email before continuing to CropAI.</p>
    {message && <p className="surface !shadow-none p-3 mt-5 text-sm" role="status">{message}</p>}
    {error && <p className="error-box mt-5" role="alert">{error}</p>}
    <div className="grid gap-3 mt-6">
      <button className="primary-button w-full" onClick={checkVerification} disabled={checking}><CheckCircle2 className="w-4 h-4" />{checking ? 'Checking…' : "I've Verified My Email"}</button>
      <button className="secondary-button w-full" onClick={resend} disabled={resending || cooldown > 0}><RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />{cooldown > 0 ? `Resend available in ${cooldown}s` : resending ? 'Sending…' : 'Resend Verification Email'}</button>
      <button className="secondary-button w-full" onClick={signOutNow}><LogOut className="w-4 h-4" /> Sign Out</button>
    </div>
    <p className="text-xs muted mt-5">Check your spam or promotions folder if the email does not appear.</p>
  </div></div>
}
