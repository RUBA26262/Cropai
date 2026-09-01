import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'

import RoleRoute from './components/RoleRoute'

const Landing = lazy(() => import('./pages/public/Landing'))
const Login = lazy(() => import('./pages/public/Login'))
const Register = lazy(() => import('./pages/public/Register'))
const VerifyEmail = lazy(() => import('./pages/public/VerifyEmail'))
const Dashboard = lazy(() => import('./pages/farmer/Dashboard'))
const Farms = lazy(() => import('./pages/farmer/Farms'))
const Scan = lazy(() => import('./pages/farmer/Scan'))
const History = lazy(() => import('./pages/farmer/History'))
const Alerts = lazy(() => import('./pages/farmer/Alerts'))
const Settings = lazy(() => import('./pages/farmer/Settings'))
const ExpertQueue = lazy(() => import('./pages/expert/ExpertQueue'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] grid place-items-center muted">Loading…</div>}><Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/farms" element={<Farms />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/history" element={<History />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/expert" element={<RoleRoute roles={['expert']}><ExpertQueue /></RoleRoute>} />
        <Route path="/admin" element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  )
}
