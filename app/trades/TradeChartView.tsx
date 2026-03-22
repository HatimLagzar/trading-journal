'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CandlestickSeries, ColorType, HistogramSeries, createChart } from 'lightweight-charts'
import type { UTCTimestamp } from 'lightweight-charts'
import { useTheme } from '@/lib/ThemeContext'
import type { Trade } from '@/services/trade'

interface TradeChartViewProps {
  trade: Trade
  systemLabel: string
  onClose: () => void
}

type KlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

type CandlePoint = {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type VolumePoint = {
  time: UTCTimestamp
  value: number
  color: string
}

const TIMEFRAME_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
]

const DEFAULT_TIMEFRAME = '1h'
const TIMEFRAME_STORAGE_KEY = 'trade_chart_timeframe'

export default function TradeChartView({ trade, systemLabel, onClose }: TradeChartViewProps) {
  const { isDark } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [candles, setCandles] = useState<CandlePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entryLineX, setEntryLineX] = useState<number | null>(null)
  const [contextMultiplier, setContextMultiplier] = useState(1)
  const [selectedInterval, setSelectedInterval] = useState<string>(() => readStoredTimeframe())

  const volumeData = useMemo<VolumePoint[]>(() => {
    return candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(34, 197, 94, 0.45)' : 'rgba(239, 68, 68, 0.45)',
    }))
  }, [candles])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TIMEFRAME_STORAGE_KEY, selectedInterval)
  }, [selectedInterval])

  useEffect(() => {
    setContextMultiplier(1)
  }, [trade.id])

  const config = useMemo(() => {
    const symbol = `${normalizeBaseAsset(trade.coin)}USDT`
    const entryMs = getTradeTimestampMs(trade.trade_date, trade.trade_time)
    const interval = selectedInterval
    const baseHalfFetchWindowMs = trade.trade_time
      ? 12 * 24 * 60 * 60 * 1000
      : 90 * 24 * 60 * 60 * 1000

    const baseHalfVisibleWindowMs = trade.trade_time
      ? 4 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000

    const halfFetchWindowMs = baseHalfFetchWindowMs * contextMultiplier
    const halfVisibleWindowMs = baseHalfVisibleWindowMs * contextMultiplier

    const intervalMs = intervalToMs(interval)

    return {
      symbol,
      interval,
      intervalSeconds: Math.floor(intervalMs / 1000),
      intervalMs,
      entryMs,
      startMs: entryMs - halfFetchWindowMs,
      endMs: entryMs + halfFetchWindowMs,
      halfVisibleWindowSec: Math.floor(halfVisibleWindowMs / 1000),
    }
  }, [contextMultiplier, selectedInterval, trade.coin, trade.trade_date, trade.trade_time])

  useEffect(() => {
    let isCancelled = false

    async function loadCandles() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchCandlesAroundEntry({
          symbol: config.symbol,
          interval: config.interval,
          intervalMs: config.intervalMs,
          startMs: config.startMs,
          endMs: config.endMs,
          entryMs: config.entryMs,
        })
        if (isCancelled) return

        const nextCandles = data.map((row) => ({
          time: Math.floor(row[0] / 1000) as UTCTimestamp,
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        }))

        setCandles(nextCandles)
      } catch (err) {
        if (isCancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load chart')
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadCandles()

    return () => {
      isCancelled = true
    }
  }, [config.endMs, config.entryMs, config.interval, config.intervalMs, config.startMs, config.symbol])

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#cbd5e1',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.15)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.15)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.3)',
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(148, 163, 184, 0.3)' },
        horzLine: { color: 'rgba(148, 163, 184, 0.3)' },
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    })

    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.74,
        bottom: 0,
      },
    })

    series.setData(candles)
    volumeSeries.setData(volumeData)

    const entryPriceLine = series.createPriceLine({
      price: trade.avg_entry,
      color: '#6b7280',
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Entry',
    })

    const stopPriceLine = trade.stop_loss !== null
      ? series.createPriceLine({
          price: trade.stop_loss,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Stop',
        })
      : null

    const exitPriceLine = trade.avg_exit !== null
      ? series.createPriceLine({
          price: trade.avg_exit,
          color: '#22c55e',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Exit',
        })
      : null

    chart.timeScale().fitContent()
    const targetTime = Math.floor(config.entryMs / 1000) as UTCTimestamp
    const markerTime = findNearestCandleTime(candles, targetTime)
    const markerIndex = findNearestCandleIndex(candles, markerTime)
    const baseHalfBars = Math.max(30, Math.floor(config.halfVisibleWindowSec / config.intervalSeconds))
    const visibleHalfBars = baseHalfBars

    chart.timeScale().setVisibleLogicalRange({
      from: markerIndex - visibleHalfBars,
      to: markerIndex + visibleHalfBars,
    })

    const updateEntryLinePosition = () => {
      const x = chart.timeScale().timeToCoordinate(markerTime)
      if (x === null) {
        setEntryLineX(null)
        return
      }
      setEntryLineX(x)
    }

    chart.timeScale().subscribeVisibleTimeRangeChange(updateEntryLinePosition)
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateEntryLinePosition)

    const handleResize = () => {
      if (!containerRef.current) return
      chart.applyOptions({ width: containerRef.current.clientWidth })
      updateEntryLinePosition()
    }

    updateEntryLinePosition()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateEntryLinePosition)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateEntryLinePosition)
      setEntryLineX(null)
      series.removePriceLine(entryPriceLine)
      if (stopPriceLine) series.removePriceLine(stopPriceLine)
      if (exitPriceLine) series.removePriceLine(exitPriceLine)
      chart.remove()
    }
  }, [candles, config.entryMs, config.halfVisibleWindowSec, config.intervalSeconds, trade.avg_entry, trade.avg_exit, trade.stop_loss, volumeData])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Trade Chart</h2>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            BINANCE:{config.symbol} • {config.interval} • UTC anchor: {trade.trade_date} {trade.trade_time || '00:00:00'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-white/15 text-slate-100 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          Close
        </button>
      </div>

      <div className={`rounded-lg border p-4 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
        <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Trade Details</p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Detail
            label="Trade #"
            value={String(trade.trade_number)}
            valueClassName="inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white"
          />
          <Detail label="Date (UTC)" value={trade.trade_date} />
          <Detail label="Time (UTC)" value={trade.trade_time || '00:00:00'} />
          <Detail label="System" value={systemLabel || trade.system_number || '-'} />
          <Detail
            label="Asset"
            value={trade.coin.toUpperCase()}
            valueClassName="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-800"
          />
          <Detail
            label="Direction"
            value={trade.direction.toUpperCase()}
            valueClassName={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              trade.direction === 'long'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          />
          <Detail label="Entry" value={formatPrice(trade.avg_entry)} />
          <Detail label="Stop" value={formatOptionalPrice(trade.stop_loss)} />
          <Detail label="Exit" value={formatOptionalPrice(trade.avg_exit)} />
          <Detail label="Risk" value={formatOptionalDollar(trade.risk)} />
          <Detail label="R-Multiple" value={formatOptionalR(trade.r_multiple)} />
          <Detail
            label="P&L"
            value={formatPnl(trade.realised_win, trade.realised_loss)}
            valueClassName={getPnlValueClassName(trade.realised_win, trade.realised_loss)}
          />
        </div>
        {trade.notes && (
          <div className={`mt-3 rounded-md border px-3 py-2 ${isDark ? 'border-white/10 bg-slate-950/50' : 'border-slate-200 bg-white'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Notes</p>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{trade.notes}</p>
          </div>
        )}
      </div>

      {loading && <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading chart candles...</p>}

      {!loading && !error && candles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSelectedInterval(option.value)
                setContextMultiplier(1)
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                selectedInterval === option.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : isDark
                    ? 'border-white/15 bg-slate-950 text-slate-100 hover:bg-white/5'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setContextMultiplier((prev) => Math.min(prev + 1, 6))}
            disabled={contextMultiplier >= 6}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${isDark ? 'border-white/15 bg-slate-950 text-slate-100 hover:bg-white/5' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Load More Context
          </button>
        </div>
      )}

      {!loading && error && (
        <div className={`rounded-lg border p-3 text-sm ${isDark ? 'border-rose-400/20 bg-rose-400/10 text-rose-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {error}
        </div>
      )}

      {!loading && !error && candles.length === 0 && (
        <div className={`rounded-lg border p-3 text-sm ${isDark ? 'border-white/10 bg-white/[0.03] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          No candle data found for this period.
        </div>
      )}

      <div className={`relative min-h-[420px] w-full overflow-hidden rounded-lg border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div ref={containerRef} className="min-h-[420px] w-full" />
        {entryLineX !== null && (
          <>
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-cyan-300/90"
              style={{ left: `${entryLineX}px` }}
            />
            <div
              className="pointer-events-none absolute top-2 z-20 -translate-x-1/2 rounded bg-cyan-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900"
              style={{ left: `${entryLineX}px` }}
            >
              Entry Time
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function readStoredTimeframe(): string {
  if (typeof window === 'undefined') return DEFAULT_TIMEFRAME

  const saved = window.localStorage.getItem(TIMEFRAME_STORAGE_KEY)
  if (!saved) return DEFAULT_TIMEFRAME

  const isValid = TIMEFRAME_OPTIONS.some((option) => option.value === saved)
  return isValid ? saved : DEFAULT_TIMEFRAME
}

async function fetchCandlesAroundEntry(config: {
  symbol: string
  interval: string
  intervalMs: number
  startMs: number
  endMs: number
  entryMs: number
}): Promise<KlineRow[]> {
  const [beforeRows, afterRows] = await Promise.all([
    fetchDirectionalCandles({
      symbol: config.symbol,
      interval: config.interval,
      intervalMs: config.intervalMs,
      direction: 'before',
      boundaryMs: config.entryMs,
      limitMs: config.startMs,
    }),
    fetchDirectionalCandles({
      symbol: config.symbol,
      interval: config.interval,
      intervalMs: config.intervalMs,
      direction: 'after',
      boundaryMs: config.entryMs,
      limitMs: config.endMs,
    }),
  ])

  const mergedMap = new Map<number, KlineRow>()
  ;[...beforeRows, ...afterRows].forEach((row) => {
    mergedMap.set(row[0], row)
  })

  return Array.from(mergedMap.values())
    .filter((row) => row[0] >= config.startMs && row[0] <= config.endMs)
    .sort((a, b) => a[0] - b[0])
}

async function fetchDirectionalCandles(config: {
  symbol: string
  interval: string
  intervalMs: number
  direction: 'before' | 'after'
  boundaryMs: number
  limitMs: number
}): Promise<KlineRow[]> {
  const rows: KlineRow[] = []
  let cursor = config.boundaryMs
  const maxRequests = 8

  for (let requestCount = 0; requestCount < maxRequests; requestCount += 1) {
    const query = new URLSearchParams({
      symbol: config.symbol,
      interval: config.interval,
      limit: '1000',
    })

    if (config.direction === 'before') {
      query.set('endTime', String(cursor))
    } else {
      query.set('startTime', String(cursor))
    }

    const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`)
    if (!response.ok) {
      throw new Error('Failed to load chart candles from Binance')
    }

    const batch = (await response.json()) as KlineRow[]
    if (batch.length === 0) break

    rows.push(...batch)

    const firstOpenTime = batch[0][0]
    const lastOpenTime = batch[batch.length - 1][0]

    if (config.direction === 'before') {
      if (firstOpenTime <= config.limitMs) break
      cursor = firstOpenTime - 1
    } else {
      if (lastOpenTime >= config.limitMs) break
      cursor = lastOpenTime + config.intervalMs
    }
  }

  return rows
}

function normalizeBaseAsset(rawAsset: string): string {
  const normalized = rawAsset.trim().toUpperCase()
  if (!normalized) return 'BTC'

  const withoutPairSeparators = normalized.split(/[/:_-]/)[0]
  const candidate = withoutPairSeparators.endsWith('USDT')
    ? withoutPairSeparators.slice(0, -4)
    : withoutPairSeparators

  const alphanumeric = candidate.replace(/[^A-Z0-9]/g, '')
  return alphanumeric || 'BTC'
}

function getTradeTimestampMs(tradeDate: string, tradeTime: string | null): number {
  const normalizedTime = normalizeTradeTime(tradeTime)
  const fallbackTime = '00:00:00'
  const utcDate = new Date(`${tradeDate}T${normalizedTime || fallbackTime}Z`)

  if (Number.isNaN(utcDate.getTime())) {
    return Date.now()
  }

  return utcDate.getTime()
}

function intervalToMs(interval: string): number {
  if (interval === '5m') return 5 * 60 * 1000
  if (interval === '15m') return 15 * 60 * 1000
  if (interval === '1h') return 60 * 60 * 1000
  if (interval === '4h') return 4 * 60 * 60 * 1000
  if (interval === '1d') return 24 * 60 * 60 * 1000
  return 60 * 60 * 1000
}

function normalizeTradeTime(tradeTime: string | null): string | null {
  if (!tradeTime) return null
  const trimmed = tradeTime.trim()
  if (!trimmed) return null

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

function findNearestCandleTime(candles: CandlePoint[], target: UTCTimestamp): UTCTimestamp {
  if (candles.length === 0) return target

  let nearest = candles[0].time
  let nearestDistance = Math.abs(Number(nearest) - Number(target))

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index].time
    const distance = Math.abs(Number(current) - Number(target))
    if (distance < nearestDistance) {
      nearest = current
      nearestDistance = distance
    }
  }

  return nearest
}

function findNearestCandleIndex(candles: CandlePoint[], target: UTCTimestamp): number {
  if (candles.length === 0) return 0

  let nearestIndex = 0
  let nearestDistance = Math.abs(Number(candles[0].time) - Number(target))

  for (let index = 1; index < candles.length; index += 1) {
    const distance = Math.abs(Number(candles[index].time) - Number(target))
    if (distance < nearestDistance) {
      nearestIndex = index
      nearestDistance = distance
    }
  }

  return nearestIndex
}

function Detail({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={valueClassName ?? 'font-medium text-slate-900'}>{value}</p>
    </div>
  )
}

function formatPrice(value: number): string {
  return Number(value.toFixed(6)).toString()
}

function formatOptionalPrice(value: number | null): string {
  if (value === null) return '-'
  return formatPrice(value)
}

function formatOptionalDollar(value: number | null): string {
  if (value === null) return '-'
  return `$${value.toFixed(2)}`
}

function formatOptionalR(value: number | null): string {
  if (value === null) return '-'
  const rounded = Number(value.toFixed(2))
  return `${rounded >= 0 ? '+' : ''}${rounded}R`
}

function formatPnl(realisedWin: number | null, realisedLoss: number | null): string {
  if (realisedWin !== null && realisedWin > 0) return `+$${realisedWin.toFixed(2)}`
  if (realisedLoss !== null && realisedLoss > 0) return `-$${realisedLoss.toFixed(2)}`
  return '-'
}

function getPnlValueClassName(realisedWin: number | null, realisedLoss: number | null): string {
  if (realisedWin !== null && realisedWin > 0) {
    return 'inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800'
  }

  if (realisedLoss !== null && realisedLoss > 0) {
    return 'inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800'
  }

  return 'font-medium text-slate-900'
}
