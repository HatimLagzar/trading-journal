'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from '@/lib/ThemeContext'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  closeOnOverlayClick?: boolean
  contentClassName?: string
  draggable?: boolean
  dragHandleSelector?: string
}

export default function Modal({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
  contentClassName = '',
  draggable = false,
  dragHandleSelector = '[data-modal-drag-handle="true"]',
}: ModalProps) {
  const { isDark } = useTheme()
  const modalRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    didDragRef.current = false

    const modalElement = modalRef.current
    if (!modalElement) return

    modalElement.style.position = ''
    modalElement.style.left = ''
    modalElement.style.top = ''
    modalElement.style.margin = ''
  }, [isOpen])

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!draggable) return
    if (window.innerWidth < 768) return
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    if (!target.closest(dragHandleSelector)) return

    const modalElement = modalRef.current
    if (!modalElement) return

    const rect = modalElement.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const initialLeft = rect.left
    const initialTop = rect.top
    let dragged = false

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const maxLeft = Math.max(12, window.innerWidth - rect.width - 12)
      const maxTop = Math.max(12, window.innerHeight - rect.height - 12)
      const nextLeft = clamp(initialLeft + (moveEvent.clientX - startX), 12, maxLeft)
      const nextTop = clamp(initialTop + (moveEvent.clientY - startY), 12, maxTop)

      if (!dragged && (Math.abs(moveEvent.clientX - startX) > 2 || Math.abs(moveEvent.clientY - startY) > 2)) {
        dragged = true
        didDragRef.current = true
      }

      modalElement.style.position = 'fixed'
      modalElement.style.left = `${nextLeft}px`
      modalElement.style.top = `${nextTop}px`
      modalElement.style.margin = '0'
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''

      if (dragged) {
        window.setTimeout(() => {
          didDragRef.current = false
        }, 0)
      }
    }

    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    event.preventDefault()
  }

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? 'bg-slate-950/72 backdrop-blur-sm' : 'bg-black/50'}`}
      onClick={closeOnOverlayClick ? () => {
        if (didDragRef.current) return
        onClose()
      } : undefined}
    >
      <div
        ref={modalRef}
        className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl shadow-xl ${isDark ? 'border border-white/10 bg-[#0a1726] text-slate-100' : 'bg-white'} ${contentClassName}`}
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}
