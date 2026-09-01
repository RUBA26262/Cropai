import { useRef, useState } from 'react'
import { UploadCloud, Camera, Image as ImageIcon } from 'lucide-react'

export default function UploadZone({ onFileSelected }) {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file) => {
    if (!file) return
    setPreview(URL.createObjectURL(file))
    onFileSelected(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? 'border-[var(--primary)] bg-[var(--surface-muted)]' : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
    >
      {preview ? (
        <img src={preview} alt="Selected leaf" className="mx-auto max-h-64 rounded-xl object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-forest-500">
          <UploadCloud className="w-10 h-10" />
          <p className="text-sm">Drag and drop a leaf photo, or choose an option below</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mt-5">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-forest-700 text-cream text-sm font-medium hover:bg-forest-800 transition-colors"
        >
          <ImageIcon className="w-4 h-4" /> Upload image
        </button>
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="secondary-button text-sm"
        >
          <Camera className="w-4 h-4" /> Open camera
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  )
}
