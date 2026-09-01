import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class AppErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('CropAI interface error', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="min-h-screen bg-[var(--background)] text-[var(--text)] grid place-items-center p-6">
      <section className="surface max-w-lg p-8 text-center"><AlertTriangle className="w-10 h-10 mx-auto text-[var(--danger)]" /><h1 className="text-2xl font-semibold mt-4">CropAI could not display this page</h1><p className="muted mt-2">Your data is safe. Reload the page to reconnect to the application.</p><button className="primary-button mt-5" onClick={() => window.location.reload()}>Reload CropAI</button></section>
    </main>
  }
}
