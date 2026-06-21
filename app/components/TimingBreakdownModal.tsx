'use client'

import Modal from '@/app/trades/Modal'
import PerformanceHistogram from '@/app/components/PerformanceHistogram'
import { useTheme } from '@/lib/ThemeContext'
import type { TimingBucket } from '@/lib/performance-timing'

interface TimingBreakdownModalProps {
  isOpen: boolean
  onClose: () => void
  weekdayBuckets: TimingBucket[]
  hourBuckets: TimingBucket[]
  tradeCount: number
  metricLabel: string
  valueFormatter: (value: number) => string
  filtersActive?: boolean
}

export default function TimingBreakdownModal({
  isOpen,
  onClose,
  weekdayBuckets,
  hourBuckets,
  tradeCount,
  metricLabel,
  valueFormatter,
  filtersActive = false,
}: TimingBreakdownModalProps) {
  const { isDark } = useTheme()

  const mutedTextClass = isDark ? 'text-slate-400' : 'text-gray-500'
  const headingClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const borderClass = isDark ? 'border-white/10' : 'border-slate-200'

  const contextLabel = tradeCount === 0
    ? 'No trades in the current view'
    : `Based on ${tradeCount} trade${tradeCount === 1 ? '' : 's'}${filtersActive ? ' · filters active' : ''}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="max-w-7xl overflow-hidden"
      innerClassName="p-0"
    >
      <div className="flex max-h-[90vh] flex-col">
        <div className={`border-b px-6 pb-4 pt-6 ${borderClass}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className={`text-xl font-semibold tracking-tight ${headingClass}`}>
                Timing breakdown
              </h2>
              <p className={`mt-1 text-sm ${mutedTextClass}`}>{contextLabel}</p>
              <p className={`mt-1 text-xs ${mutedTextClass}`}>Metric: {metricLabel} · UTC buckets</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg px-2 py-1 text-lg leading-none ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}
              aria-label="Close timing breakdown"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <PerformanceHistogram
            title="By day of week"
            buckets={weekdayBuckets}
            valueFormatter={valueFormatter}
            isDark={isDark}
          />
          <PerformanceHistogram
            title="By hour (UTC)"
            buckets={hourBuckets}
            valueFormatter={valueFormatter}
            isDark={isDark}
            scrollable
          />
        </div>
      </div>
    </Modal>
  )
}
