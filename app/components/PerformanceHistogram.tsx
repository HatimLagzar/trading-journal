'use client'

import type { TimingBucket } from '@/lib/performance-timing'

interface PerformanceHistogramProps {
  title: string
  buckets: TimingBucket[]
  valueFormatter: (value: number) => string
  isDark: boolean
  scrollable?: boolean
}

const CHART_HEIGHT_PX = 160
const MIN_BAR_HEIGHT_PX = 4

export default function PerformanceHistogram({
  title,
  buckets,
  valueFormatter,
  isDark,
  scrollable = false,
}: PerformanceHistogramProps) {
  const maxAbs = Math.max(...buckets.map((bucket) => Math.abs(bucket.total)), 0)
  const hasData = buckets.some((bucket) => bucket.tradeCount > 0)

  const mutedTextClass = isDark ? 'text-slate-400' : 'text-gray-500'
  const headingClass = isDark ? 'text-slate-200' : 'text-slate-900'
  const baselineClass = isDark ? 'bg-white/20' : 'bg-slate-300'
  const zeroLabelClass = isDark ? 'text-slate-500' : 'text-slate-400'

  const chart = (
    <div
      className={`grid gap-2 ${scrollable ? 'min-w-[720px]' : ''}`}
      style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
    >
      {buckets.map((bucket) => {
        const magnitude = maxAbs > 0 ? Math.abs(bucket.total) / maxAbs : 0
        const barHeightPx = bucket.total === 0
          ? 0
          : Math.max(MIN_BAR_HEIGHT_PX, magnitude * (CHART_HEIGHT_PX / 2 - MIN_BAR_HEIGHT_PX))

        const valueClass = bucket.total > 0
          ? 'text-green-600'
          : bucket.total < 0
            ? 'text-red-600'
            : mutedTextClass

        const barClass = bucket.total > 0
          ? 'bg-green-500'
          : bucket.total < 0
            ? 'bg-red-500'
            : isDark ? 'bg-white/10' : 'bg-slate-200'

        return (
          <div key={bucket.key} className="flex min-w-0 flex-col items-center">
            <div
              className="relative flex w-full flex-col items-center justify-center"
              style={{ height: CHART_HEIGHT_PX }}
            >
              <div className="flex h-1/2 w-full items-end justify-center">
                {bucket.total > 0 && (
                  <div
                    className={`w-3/5 max-w-8 rounded-t ${barClass}`}
                    style={{ height: `${barHeightPx}px` }}
                    title={`${bucket.label}: ${valueFormatter(bucket.total)} (${bucket.tradeCount} trades)`}
                  />
                )}
              </div>
              <div className={`h-px w-full ${baselineClass}`} />
              <div className="flex h-1/2 w-full items-start justify-center">
                {bucket.total < 0 && (
                  <div
                    className={`w-3/5 max-w-8 rounded-b ${barClass}`}
                    style={{ height: `${barHeightPx}px` }}
                    title={`${bucket.label}: ${valueFormatter(bucket.total)} (${bucket.tradeCount} trades)`}
                  />
                )}
              </div>
            </div>

            <p className={`mt-2 w-full truncate text-center text-[11px] font-medium ${headingClass}`}>
              {scrollable ? bucket.label : bucket.label.slice(0, 3)}
            </p>
            <p className={`w-full truncate text-center text-[11px] font-semibold ${valueClass}`}>
              {valueFormatter(bucket.total)}
            </p>
            <p className={`w-full truncate text-center text-[10px] ${mutedTextClass}`}>
              {bucket.tradeCount} {bucket.tradeCount === 1 ? 'trade' : 'trades'}
            </p>
          </div>
        )
      })}
    </div>
  )

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={`text-sm font-semibold ${headingClass}`}>{title}</h3>
        {!hasData && (
          <span className={`text-xs ${mutedTextClass}`}>No trades in range</span>
        )}
      </div>

      {!hasData ? (
        <div className={`rounded-lg border border-dashed px-4 py-8 text-center text-sm ${isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-gray-500'}`}>
          No timing data for the current filters.
        </div>
      ) : scrollable ? (
        <div className="overflow-x-auto pb-1">
          {chart}
        </div>
      ) : (
        chart
      )}

      {hasData && maxAbs === 0 && (
        <p className={`mt-2 text-xs ${zeroLabelClass}`}>All buckets net to zero for the selected trades.</p>
      )}
    </section>
  )
}
