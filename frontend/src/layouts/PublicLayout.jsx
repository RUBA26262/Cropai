import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)] transition-colors duration-200">
      <Navbar />
      <Outlet />
      <footer className="mt-24 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 py-10 text-sm muted flex flex-col sm:flex-row gap-3 justify-between">
          <span>© {new Date().getFullYear()} CropAI Maharashtra.</span>
          <span>Decision support, not a substitute for field diagnosis.</span>
        </div>
      </footer>
    </div>
  )
}
