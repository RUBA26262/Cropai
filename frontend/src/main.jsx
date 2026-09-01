import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { I18nProvider } from './context/I18nContext.jsx'
import './styles/index.css'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider><I18nProvider><AuthProvider><App /></AuthProvider></I18nProvider></ThemeProvider>
    </BrowserRouter></AppErrorBoundary>
  </React.StrictMode>,
)
