import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-forest-500">Loading…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role === 'farmer' && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />
  }
  return children
}
