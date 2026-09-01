import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const resolvedTheme = (preference) => preference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('cropai_theme') || 'system')
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.classList.toggle('dark', resolvedTheme(theme) === 'dark')
      document.documentElement.dataset.theme = resolvedTheme(theme)
      document.documentElement.style.colorScheme = resolvedTheme(theme)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  const setTheme = (value) => {
    if (!['light', 'dark', 'system'].includes(value)) return
    localStorage.setItem('cropai_theme', value)
    setThemeState(value)
  }
  const value = useMemo(() => ({ theme, setTheme, resolved: resolvedTheme(theme) }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
