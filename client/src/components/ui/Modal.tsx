import { useEffect } from 'react'
import { IconX } from '@tabler/icons-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}

export default function Modal({ title, onClose, children, width = 'max-w-md' }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(10,16,32,0.8)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-surface border border-border-strong rounded-xl w-full ${width} shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-md font-semibold text-ink-primary">{title}</h2>
          <button onClick={onClose} className="btn-icon">
            <IconX size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
