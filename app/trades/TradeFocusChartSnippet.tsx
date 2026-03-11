'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CandlestickSeries, ColorType, HistogramSeries, createChart } from 'lightweight-charts'
import type { UTCTimestamp } from 'lightweight-charts'
import type { Trade } from '@/services/trade'

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

interface TradeFocusChartSnippetProps {
  trade: Trade
}

export default function TradeFocusChartSnippet({ trade }: TradeFocusChartSnippetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [candles, setCandles] = useState<CandlePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const config = useMemo(() => {
    const symbol = `${normalizeBaseAsset(trade.coin)}USDT`
    const interval = '1h'
    const intervalMs = 60 * 60 * 1000
    const entryMs = getTradeTimestampMs(trade.trade_date, trade.trade_time)
    const halfWindowMs = trade.trade_time
      ? 7 * 24 * 60 * 60 * 1000
      : 45 * 24 * 60 * 60 * 1000

    return {
      symbol,
      interval,
      intervalMs,
      entryMs,
      startMs: entryMs - halfWindowMs,
      endMs: entryMs + halfWindowMs,
    }
  }, [trade.coin, trade.trade_date, trade.trade_time])

  const volumeData = useMemo<VolumePoint[]>(() => {
    return candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(22, 163, 74, 0.45)' : 'rgba(220, 38, 38, 0.45)',
    }))
  }, [candles])

  useEffect(() => {
    let isCancelled = false

    async function loadCandles() {
      setLoading(true)
      setError(null)

      try {
        const query = new URLSearchParams({
          symbol: config.symbol,
          interval: config.interval,
          startTime: String(config.startMs),
          endTime: String(config.endMs),
          limit: '1000',
        })

        const response = await fetch(`https://api.binance.com/api/v3/klines?${query.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to load chart snippet')
        }

        const rawRows = (await response.json()) as KlineRow[]
        if (isCancelled) return

        const nextCandles = rawRows.map((row) => ({
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
        setError(err instanceof Error ? err.message : 'Failed to load chart snippet')
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
  }, [config.endMs, config.interval, config.startMs, config.symbol])

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: '#0b1220' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.13)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.13)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148, 163, 184, 0.25)',
      },
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.25)',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderVisible: false,
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
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
      color: '#38bdf8',
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Entry',
    })

    const stopPriceLine = trade.stop_loss !== null
      ? series.createPriceLine({
          price: trade.stop_loss,
          color: '#f87171',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Stop',
        })
      : null

    const exitPriceLine = trade.avg_exit !== null
      ? series.createPriceLine({
          price: trade.avg_exit,
          color: '#4ade80',
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Exit',
        })
      : null

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (!containerRef.current) return
      chart.applyOptions({ width: containerRef.current.clientWidth })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      series.removePriceLine(entryPriceLine)
      if (stopPriceLine) series.removePriceLine(stopPriceLine)
      if (exitPriceLine) series.removePriceLine(exitPriceLine)
      chart.remove()
    }
  }, [candles, trade.avg_entry, trade.avg_exit, trade.stop_loss, volumeData])

  if (loading) {
    return <p className="text-sm text-slate-500">Loading chart snippet...</p>
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  if (candles.length === 0) {
    return <p className="text-sm text-slate-500">No candle data available for this trade.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">BINANCE:{config.symbol} · 1h · UTC</p>
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <div ref={containerRef} className="h-[320px] w-full" />
      </div>
    </div>
  )
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
