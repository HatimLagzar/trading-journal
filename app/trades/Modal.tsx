'use client'

import { useTheme } from '@/lib/ThemeContext'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  closeOnOverlayClick?: boolean
  contentClassName?: string
}

export default function Modal({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
  contentClassName = '',
}: ModalProps) {
  const { isDark } = useTheme()

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? 'bg-slate-950/72 backdrop-blur-sm' : 'bg-black/50'}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-xl ${isDark ? 'border border-white/10 bg-[#0a1726] text-slate-100' : 'bg-white'} ${contentClassName}`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
