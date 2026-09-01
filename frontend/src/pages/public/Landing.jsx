import { Link } from 'react-router-dom'
import { Leaf, ScanLine, CloudSun, MessageCircle, ShieldCheck, ArrowRight } from 'lucide-react'

const STEPS = [
  { title: 'Add your farm', desc: 'Register your farm, location, and the crops you grow.' },
  { title: 'Scan a leaf', desc: 'Upload or photograph a leaf from your field.' },
  { title: 'Run validated analysis', desc: 'The system refuses to guess when confidence or image quality is insufficient.' },
  { title: 'Review the evidence', desc: 'Use integrated management guidance or escalate an uncertain case to a verified expert.' },
]

const FEATURES = [
  { icon: ScanLine, title: 'Guided multi-photo capture', desc: 'Close-up and whole-plant views improve quality and preserve uncertainty.' },
  { icon: CloudSun, title: 'Explainable weather risk', desc: 'Crop-linked weather conditions help prioritize field inspection; risk is clearly labelled heuristic.' },
  { icon: MessageCircle, title: 'Three-language support', desc: 'Farmer workflows support Marathi, Hindi and English.' },
  { icon: ShieldCheck, title: 'Private by design', desc: 'Images are private, roles are server-controlled, and experts only see assigned cases.' },
]

const CROPS = ['Cotton', 'Soybean', 'Sugarcane', 'Onion', 'Tomato', 'Pomegranate']

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] bg-[var(--surface-muted)] px-3 py-1 rounded-full">
            <Leaf className="w-3.5 h-3.5" /> AI-powered crop health
          </span>
          <h1 className="mt-5 text-5xl leading-tight font-display font-semibold text-[var(--text)]">
            Protect your crops with AI.
          </h1>
          <p className="mt-5 text-lg muted max-w-md">
            Secure decision support for Maharashtra crop diseases and pests, with explicit
            uncertainty and verified-expert escalation.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link to="/register" className="primary-button !px-6 !py-3">
              Start scanning free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="link">
              I already have an account
            </Link>
          </div>
        </div>

        {/* Scan demo card */}
        <div className="surface rounded-3xl p-6">
          <div className="rounded-2xl bg-forest-900 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-forest-800 to-forest-900" />
            <ScanLine className="w-16 h-16 text-forest-300 relative animate-pulse" />
            <div className="absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur rounded-xl px-4 py-3 text-cream text-sm">
              Analyzing leaf image…
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm muted">Sample result</p>
              <p className="font-display text-lg font-semibold text-[var(--text)]">Validated model required</p>
            </div>
            <span className="text-sm font-semibold text-clay-600">No mock results</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--surface-muted)] py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-display font-semibold text-[var(--text)] text-center">How it works</h2>
          <div className="mt-12 grid md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <span className="text-sm font-semibold text-[var(--primary)]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 font-display text-lg font-semibold text-[var(--text)]">{step.title}</h3>
                <p className="mt-2 text-sm muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-display font-semibold text-[var(--text)] text-center">Everything a farm needs</h2>
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface !shadow-none p-6 flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-[var(--text)]">{f.title}</h3>
                <p className="mt-1 text-sm muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Supported crops */}
      <section className="bg-forest-900 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl font-display font-semibold text-cream text-center">Supported crops</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {CROPS.map((crop) => (
              <span key={crop} className="px-4 py-2 rounded-full bg-forest-800 text-forest-100 text-sm">
                {crop}
              </span>
            ))}
          </div>
          <p className="text-center text-forest-400 text-xs mt-6">New crops are released only after dataset and field-validation gates pass.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-display font-semibold text-[var(--text)]">Start protecting your harvest today</h2>
        <p className="mt-3 muted">Free to get started. No credit card required.</p>
        <Link to="/register" className="primary-button mt-8 !px-7 !py-3.5">
          Create your account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  )
}
