import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] transition-colors duration-200">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
