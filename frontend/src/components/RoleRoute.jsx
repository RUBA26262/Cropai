import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center muted">Loading secure session…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role) || (user.role === 'expert' && !user.expertVerified)) return <Navigate to="/dashboard" replace />
  return children
}
