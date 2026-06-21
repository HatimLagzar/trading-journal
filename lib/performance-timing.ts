export type TimingBucket = {
  key: string
  label: string
  total: number
  tradeCount: number
}

export type TimingTotalsEntry = {
  label: string
  total: number
}

const WEEKDAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

const HOUR_ORDER = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)

function normalizeTradeDate(tradeDate: string): string | null {
  if (!tradeDate) return null

  const trimmed = tradeDate.trim()
  if (!trimmed) return null

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const slashYmdMatch = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})/)
  if (slashYmdMatch) {
    return `${slashYmdMatch[1]}-${slashYmdMatch[2]}-${slashYmdMatch[3]}`
  }

  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWeekdayLabelFromTradeDate(tradeDate: string): string | null {
  const normalizedDate = normalizeTradeDate(tradeDate)
  if (!normalizedDate) return null

  const date = new Date(`${normalizedDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

export function getHourLabelFromTradeTime(tradeTime: string | null): string | null {
  if (!tradeTime) return null

  const trimmed = tradeTime.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2})/)
  if (!match) return null

  const hour = Number(match[1])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null

  return `${String(hour).padStart(2, '0')}:00`
}

type TimingAccumulator = {
  weekdayTotals: Map<string, number>
  hourTotals: Map<string, number>
  weekdayCounts: Map<string, number>
  hourCounts: Map<string, number>
}

export function buildTimingTotals<T>(
  items: T[],
  getValue: (item: T) => number,
  getDate: (item: T) => string,
  getTime: (item: T) => string | null,
): TimingAccumulator {
  const weekdayTotals = new Map<string, number>()
  const hourTotals = new Map<string, number>()
  const weekdayCounts = new Map<string, number>()
  const hourCounts = new Map<string, number>()

  items.forEach((item) => {
    const value = getValue(item)

    const weekdayKey = getWeekdayLabelFromTradeDate(getDate(item))
    if (weekdayKey) {
      weekdayTotals.set(weekdayKey, (weekdayTotals.get(weekdayKey) ?? 0) + value)
      weekdayCounts.set(weekdayKey, (weekdayCounts.get(weekdayKey) ?? 0) + 1)
    }

    const hourKey = getHourLabelFromTradeTime(getTime(item))
    if (hourKey) {
      hourTotals.set(hourKey, (hourTotals.get(hourKey) ?? 0) + value)
      hourCounts.set(hourKey, (hourCounts.get(hourKey) ?? 0) + 1)
    }
  })

  return {
    weekdayTotals,
    hourTotals,
    weekdayCounts,
    hourCounts,
  }
}

export function aggregateTimingBuckets<T>(
  items: T[],
  getValue: (item: T) => number,
  getDate: (item: T) => string,
  getTime: (item: T) => string | null,
): { weekdays: TimingBucket[]; hours: TimingBucket[] } {
  const { weekdayTotals, hourTotals, weekdayCounts, hourCounts } = buildTimingTotals(
    items,
    getValue,
    getDate,
    getTime,
  )

  const weekdays = WEEKDAY_ORDER.map((weekday) => ({
    key: weekday,
    label: weekday,
    total: weekdayTotals.get(weekday) ?? 0,
    tradeCount: weekdayCounts.get(weekday) ?? 0,
  }))

  const hours = HOUR_ORDER.map((hour) => ({
    key: hour,
    label: hour,
    total: hourTotals.get(hour) ?? 0,
    tradeCount: hourCounts.get(hour) ?? 0,
  }))

  return { weekdays, hours }
}

export function pickBestTimingEntry(
  map: Map<string, number>,
  labelResolver?: (key: string) => string,
): TimingTotalsEntry | null {
  const entries = Array.from(map.entries())
  if (entries.length === 0) return null

  const [key, value] = entries.reduce((best, current) => (current[1] > best[1] ? current : best))
  return {
    label: labelResolver ? labelResolver(key) : key,
    total: value,
  }
}

export function pickWorstTimingEntry(
  map: Map<string, number>,
  labelResolver?: (key: string) => string,
): TimingTotalsEntry | null {
  const entries = Array.from(map.entries())
  if (entries.length === 0) return null

  const [key, value] = entries.reduce((worst, current) => (current[1] < worst[1] ? current : worst))
  return {
    label: labelResolver ? labelResolver(key) : key,
    total: value,
  }
}

export function pickSecondBestTimingEntry(
  map: Map<string, number>,
  labelResolver?: (key: string) => string,
): TimingTotalsEntry | null {
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  if (entries.length < 2) return null

  const [key, value] = entries[1]
  return {
    label: labelResolver ? labelResolver(key) : key,
    total: value,
  }
}

export function pickSecondWorstTimingEntry(
  map: Map<string, number>,
  labelResolver?: (key: string) => string,
): TimingTotalsEntry | null {
  const entries = Array.from(map.entries()).sort((a, b) => a[1] - b[1])
  if (entries.length < 2) return null

  const [key, value] = entries[1]
  return {
    label: labelResolver ? labelResolver(key) : key,
    total: value,
  }
}

export function pickTopTwoTimingEntries(
  map: Map<string, number>,
  labelResolver?: (key: string) => string,
): { first: TimingTotalsEntry | null; second: TimingTotalsEntry | null } {
  const entries = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  return {
    first: entries[0]
      ? { label: labelResolver ? labelResolver(entries[0][0]) : entries[0][0], total: entries[0][1] }
      : null,
    second: entries[1]
      ? { label: labelResolver ? labelResolver(entries[1][0]) : entries[1][0], total: entries[1][1] }
      : null,
  }
}

export function pickBottomTwoTimingEntries(
  map: Map<string, number>,
  labelResolver?: (key: string) => string,
): { first: TimingTotalsEntry | null; second: TimingTotalsEntry | null } {
  const entries = Array.from(map.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)

  return {
    first: entries[0]
      ? { label: labelResolver ? labelResolver(entries[0][0]) : entries[0][0], total: entries[0][1] }
      : null,
    second: entries[1]
      ? { label: labelResolver ? labelResolver(entries[1][0]) : entries[1][0], total: entries[1][1] }
      : null,
  }
}
