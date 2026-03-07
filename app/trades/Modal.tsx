'use client'

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
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${contentClassName}`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
