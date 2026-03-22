'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'

export type DateRangePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'custom'

type CalendarDay = {
  date: Date
  dateKey: string
  dayNumber: number
  isCurrentMonth: boolean
  isWeekend: boolean
}

const DATE_RANGE_PRESET_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'Week' },
  { value: 'this_month', label: 'Month' },
  { value: 'last_90_days', label: '90D' },
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DateRangePickerProps {
  isDark: boolean
  selectedPreset: DateRangePreset
  startDate: string
  endDate: string
  activeLabel: string
  isActive: boolean
  filteredTradeCount: number
  error: string | null
  onPresetChange: (preset: DateRangePreset) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClear: () => void
  onReset: () => void
}

export default function DateRangePicker({
  isDark,
  selectedPreset,
  startDate,
  endDate,
  activeLabel,
  isActive,
  filteredTradeCount,
  error,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
  onReset,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => startOfUtcMonth(parseUtcDate(startDate) ?? new Date()))
  const panelRef = useRef<HTMLDivElement | null>(null)

  const selectedStartDate = useMemo(() => parseUtcDate(startDate), [startDate])
  const selectedEndDate = useMemo(() => parseUtcDate(endDate), [endDate])

  const triggerLabel = isActive ? formatDisplayRange(activeLabel) : 'Choose range'
  const selectionHint = selectedStartDate && !selectedEndDate
    ? 'Select a To date to finish the range.'
    : 'Pick a preset or select a custom UTC range.'
  const firstMonth = visibleMonth
  const secondMonth = addUtcMonths(firstMonth, 1)
  const firstMonthDays = useMemo(() => buildMonthGrid(firstMonth), [firstMonth])
  const secondMonthDays = useMemo(() => buildMonthGrid(secondMonth), [secondMonth])

  function handlePresetClick(preset: DateRangePreset) {
    onPresetChange(preset)
    if (preset !== 'custom') {
      closeCalendar()
    }
  }

  function openCalendar() {
    setHoveredDateKey(null)
    setVisibleMonth(startOfUtcMonth(selectedStartDate ?? new Date()))
    setIsOpen(true)
  }

  function closeCalendar() {
    setHoveredDateKey(null)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        closeCalendar()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  function handleCalendarDayClick(dateKey: string) {
    onPresetChange('custom')

    if (!selectedStartDate || selectedEndDate) {
      onStartDateChange(dateKey)
      onEndDateChange('')
      setHoveredDateKey(null)
      return
    }

    if (dateKey < startDate) {
      onStartDateChange(dateKey)
      onEndDateChange(startDate)
    } else {
      onEndDateChange(dateKey)
    }

    setHoveredDateKey(null)
    closeCalendar()
  }

  function handleCustomStartChange(value: string) {
    onPresetChange(value || endDate ? 'custom' : 'all')
    onStartDateChange(value)
  }

  function handleCustomEndChange(value: string) {
    onPresetChange(startDate || value ? 'custom' : 'all')
    onEndDateChange(value)
  }

  function renderMonth(month: Date, days: CalendarDay[]) {
    return (
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-center">
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
            {format(month, 'MMMM yyyy')}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={`pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] ${index >= 5
                ? (isDark ? 'text-sky-300/70' : 'text-sky-700/80')
                : (isDark ? 'text-slate-500' : 'text-gray-500')}`}
            >
              {label}
            </div>
          ))}

          {days.map((day) => {
            const previewEnd = hoveredDateKey && selectedStartDate && !selectedEndDate ? hoveredDateKey : null
            const isSelectedStart = startDate === day.dateKey
            const isSelectedEnd = endDate === day.dateKey
            const isPreviewRange = Boolean(startDate && previewEnd) && isWithinRange(day.dateKey, startDate, previewEnd ?? startDate)
            const isCommittedRange = Boolean(startDate) && Boolean(endDate) && isWithinRange(day.dateKey, startDate, endDate)
            const isInRange = isCommittedRange || isPreviewRange
            const isPreviewBoundary = previewEnd === day.dateKey && selectedStartDate && !selectedEndDate

            const containerClass = isSelectedStart || isSelectedEnd || isPreviewBoundary
              ? ''
              : isInRange
                ? (isDark ? 'bg-sky-500/18' : 'bg-sky-100')
                : day.isWeekend
                  ? (isDark ? 'bg-slate-900/60' : 'bg-slate-50')
                  : ''

            const buttonClass = isSelectedStart || isSelectedEnd || isPreviewBoundary
              ? (isDark
                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                  : 'bg-slate-900 text-white hover:bg-slate-800')
              : isInRange
                ? (isDark
                    ? 'text-sky-100 hover:bg-sky-500/28'
                    : 'text-sky-900 hover:bg-sky-200')
                : !day.isCurrentMonth
                  ? (isDark ? 'text-slate-600 hover:bg-slate-800/60' : 'text-gray-300 hover:bg-gray-100')
                  : day.isWeekend
                    ? (isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-900 hover:bg-sky-50')
                    : (isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-800 hover:bg-gray-100')

            return (
              <div
                key={day.dateKey}
                className={`rounded-md ${containerClass}`}
                onMouseEnter={() => {
                  if (selectedStartDate && !selectedEndDate) {
                    setHoveredDateKey(day.dateKey)
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => handleCalendarDayClick(day.dateKey)}
                  className={`h-10 w-full rounded-md text-sm font-medium transition-colors ${buttonClass}`}
                >
                  {day.dayNumber}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700/80 bg-slate-950/60' : 'border-gray-200 bg-white/90'}`}>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 xl:col-span-4">
          <div className="flex min-h-[1.75rem] items-end">
            <label className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Date Range (UTC)</label>
          </div>
          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => {
                if (isOpen) {
                  closeCalendar()
                  return
                }

                openCalendar()
              }}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100 hover:border-slate-500' : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
            >
              <div className="min-w-0">
                <span className="block truncate font-medium">{triggerLabel}</span>
                <span className={`block text-[11px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Tap to pick From and To on the calendar</span>
              </div>
              <span className={`ml-3 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{isOpen ? 'Close' : 'Open'}</span>
            </button>

            {isOpen && (
              <div className={`absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full min-w-[320px] rounded-xl border p-4 shadow-2xl lg:min-w-[760px] ${isDark ? 'border-slate-700 bg-[#08111d] text-slate-100' : 'border-gray-200 bg-white text-gray-900'}`}>
                <div className="flex flex-col gap-4 lg:flex-row">
                  <div className="lg:w-44">
                    <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Presets</p>
                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      {DATE_RANGE_PRESET_OPTIONS.map((option) => {
                        const isPresetActive = selectedPreset === option.value

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handlePresetClick(option.value)}
                            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors lg:text-left ${isPresetActive
                              ? (isDark ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-white')
                              : (isDark ? 'border border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100' : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900')}`}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setVisibleMonth((current) => addUtcMonths(current, -1))}
                        className={`h-9 w-9 rounded-lg border text-lg ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                      >
                        ‹
                      </button>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Click From, then To. Hover previews the range.</p>
                      <button
                        type="button"
                        onClick={() => setVisibleMonth((current) => addUtcMonths(current, 1))}
                        className={`h-9 w-9 rounded-lg border text-lg ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                      >
                        ›
                      </button>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
                      {renderMonth(firstMonth, firstMonthDays)}
                      {renderMonth(secondMonth, secondMonthDays)}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>From (UTC)</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(event) => handleCustomStartChange(event.target.value)}
                          className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-gray-300 bg-white text-gray-900'}`}
                        />
                      </div>
                      <div>
                        <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>To (UTC)</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(event) => handleCustomEndChange(event.target.value)}
                          className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-gray-300 bg-white text-gray-900'}`}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{selectionHint}</p>
                        {error && <p className={`text-xs font-medium ${isDark ? 'text-rose-300' : 'text-red-600'}`}>{error}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={onClear}
                          className={`cursor-pointer text-xs font-medium hover:underline ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                          Clear Dates
                        </button>
                        <button
                          type="button"
                          onClick={closeCalendar}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 xl:col-span-5">
          <div className="flex min-h-[1.75rem] items-end">
            <label className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Quick Presets</label>
          </div>
          <div className="flex min-h-11 flex-wrap items-center gap-2">
            {DATE_RANGE_PRESET_OPTIONS.map((option) => {
              const isPresetActive = selectedPreset === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetClick(option.value)}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isPresetActive
                    ? (isDark ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-white')
                    : (isDark ? 'border border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100' : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900')}`}
                >
                  {option.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                onPresetChange('custom')
                openCalendar()
              }}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${selectedPreset === 'custom'
                ? (isDark ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-600 text-white')
                : (isDark ? 'border border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-slate-100' : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:text-gray-900')}`}
            >
              Calendar
            </button>
          </div>
        </div>

        <div className="min-w-0 xl:col-span-3">
          <div className="flex min-h-[1.75rem] items-end">
            <label className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Status</label>
          </div>
          <div className={`flex min-h-11 flex-col justify-center rounded-lg border px-3 py-2 ${isDark ? 'border-slate-700 bg-slate-950/80' : 'border-gray-200 bg-gray-50/80'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Presets and period cards use UTC.</p>
                <p className={`truncate text-xs font-medium ${isActive ? (isDark ? 'text-sky-300' : 'text-sky-700') : (isDark ? 'text-slate-300' : 'text-gray-700')}`}>
                  {isActive ? `${activeLabel} • ${filteredTradeCount} trades` : 'No date filter active'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onClear}
                  className={`cursor-pointer text-xs font-medium hover:underline ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Clear Dates
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className={`cursor-pointer text-xs font-medium hover:underline ${isDark ? 'text-slate-300 hover:text-slate-100' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Reset Filters
                </button>
              </div>
            </div>
            {error && !isOpen && (
              <p className={`mt-2 text-xs font-medium ${isDark ? 'text-rose-300' : 'text-red-600'}`}>{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function buildMonthGrid(month: Date): CalendarDay[] {
  const monthStart = startOfUtcMonth(month)
  const startOffset = (monthStart.getUTCDay() + 6) % 7
  const gridStart = addUtcDays(monthStart, -startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addUtcDays(gridStart, index)
    return {
      date,
      dateKey: formatUtcDate(date),
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthStart.getUTCMonth(),
      isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
    }
  })
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12, 0, 0))
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12, 0, 0))
}

function addUtcDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + days)
  return nextDate
}

function parseUtcDate(value: string): Date | null {
  if (!value) return null

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isWithinRange(value: string, start: string, end: string): boolean {
  const rangeStart = start <= end ? start : end
  const rangeEnd = start <= end ? end : start
  return value >= rangeStart && value <= rangeEnd
}

function formatDisplayDate(value: string): string {
  const parsed = parseUtcDate(value)
  if (!parsed) return value
  return format(parsed, 'dd MMM yyyy')
}

function formatDisplayRange(value: string): string {
  const [start, end] = value.split(' -> ')
  if (!end) return formatDisplayDate(value)
  return `${formatDisplayDate(start)} -> ${formatDisplayDate(end)}`
}
