import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Bell, Leaf, LogOut, Menu, Settings, ShieldCheck, SunMoon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../context/I18nContext'
import { alertApi, profileApi } from '../services/api'

export default function Navbar() {
  const { user, logout } = useAuth(); const { theme, setTheme } = useTheme(); const { locale, setLocale, t } = useI18n()
  const navigate = useNavigate(); const [unreadCount, setUnreadCount] = useState(0); const [open, setOpen] = useState(false)
  useEffect(() => { if (user) alertApi.list().then((response) => setUnreadCount(response.data.filter((alert) => !alert.is_read).length)).catch(() => {}) }, [user])
  useEffect(() => { if (user?.theme && !localStorage.getItem('cropai_theme_synced')) { setTheme(user.theme); localStorage.setItem('cropai_theme_synced', 'true') }; if (user?.language && !localStorage.getItem('cropai_language_synced')) { setLocale(user.language); localStorage.setItem('cropai_language_synced', 'true') } }, [user, setTheme, setLocale])
  const updateTheme = (value) => { setTheme(value); if (user) profileApi.update({ theme: value }).catch(() => {}) }
  const updateLocale = (value) => { setLocale(value); if (user) profileApi.update({ language: value }).catch(() => {}) }
  const links = user ? [
    ['/dashboard', t('dashboard')], ['/farms', t('farms')], ['/scan', t('scan')], ['/history', t('history')],
    ...(user.role === 'expert' ? [['/expert', 'Expert queue']] : []), ...(user.role === 'admin' ? [['/admin', 'Administration']] : []),
  ] : []
  return <header className="sticky top-0 z-40 backdrop-blur bg-[color:var(--background)]/90 border-b border-[var(--border)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 text-xl font-semibold"><Leaf className="w-5 h-5 text-[var(--primary)]" /> CropAI</Link>
      <nav className="hidden lg:flex items-center gap-1">{links.map(([path, label]) => <NavLink key={path} to={path} className={({ isActive }) => `rounded-full px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'muted hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'}`}>{label}</NavLink>)}</nav>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="language">{t('language')}</label>
        <select id="language" className="field !w-auto !py-1.5 !px-2 text-xs" value={locale} onChange={(event) => updateLocale(event.target.value)}><option value="mr">मराठी</option><option value="hi">हिन्दी</option><option value="en">EN</option></select>
        <label className="sr-only" htmlFor="theme">{t('theme')}</label>
        <div className="relative"><SunMoon className="w-4 h-4 absolute left-2 top-2 muted pointer-events-none" /><select id="theme" className="field !w-auto !py-1.5 !pl-7 !pr-2 text-xs" value={theme} onChange={(event) => updateTheme(event.target.value)}><option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option></select></div>
        {user ? <>
          <NavLink to="/alerts" className={({ isActive }) => `relative rounded-full p-2 ${isActive ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'muted'}`} aria-label={t('alerts')}><Bell className="w-5 h-5" />{unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] min-w-4 h-4 rounded-full grid place-items-center">{Math.min(unreadCount, 9)}{unreadCount > 9 ? '+' : ''}</span>}</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `rounded-full p-2 ${isActive ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'muted'}`} aria-label={t('settings')}><Settings className="w-5 h-5" /></NavLink>
          <button onClick={() => logout().then(() => navigate('/'))} className="hidden sm:flex p-2 muted" aria-label={t('logout')}><LogOut className="w-5 h-5" /></button>
          <button className="lg:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </> : <><Link to="/login" className="secondary-button text-sm">Sign in</Link><Link to="/register" className="primary-button text-sm hidden sm:inline-flex">Farmer registration</Link></>}
      </div>
    </div>
    {open && user && <nav className="lg:hidden px-4 pb-4 grid gap-2 bg-[var(--background)]">{links.map(([path, label]) => <NavLink key={path} onClick={() => setOpen(false)} to={path} className={({ isActive }) => `rounded-xl border px-4 py-3 text-sm font-medium ${isActive ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-text)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}>{label}</NavLink>)}<button onClick={() => logout().then(() => navigate('/'))} className="secondary-button"><LogOut className="w-4" /> {t('logout')}</button></nav>}
    {user && user.role !== 'farmer' && <div className="bg-[var(--surface-muted)] border-t border-[var(--border)] text-xs text-center py-1 muted"><ShieldCheck className="inline w-3 h-3 mr-1" />{user.role === 'expert' ? 'Verified expert session' : 'Administrator session'}</div>}
  </header>
}
