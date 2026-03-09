'use client'

import { useState } from 'react'
import { updateTrade } from '@/services/trade'
import {
  findMatchingBacktestingTrade,
  updateBacktestingMirrorFromLiveTrade,
} from '@/services/backtesting'
import type { Trade } from '@/services/trade'

interface CloseTradeFormProps {
  trade: Trade
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export default function CloseTradeForm({ trade, userId, onClose, onSuccess }: CloseTradeFormProps) {
  const [avgExit, setAvgExit] = useState<number>(trade.avg_exit ?? 0)
  const [realisedPnl, setRealisedPnl] = useState<number>(getInitialPnl(trade))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const nextRMultiple = calculateRMultiple(trade.risk, realisedPnl)
      const { realisedWin, realisedLoss } = toWinLoss(realisedPnl)

      await updateTrade(trade.id, {
        avg_exit: avgExit,
        realised_win: realisedWin,
        realised_loss: realisedLoss,
        r_multiple: nextRMultiple,
      })

      await syncBacktestingMirror(nextRMultiple)

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close trade')
    } finally {
      setLoading(false)
    }
  }

  async function syncBacktestingMirror(nextRMultiple: number | null) {
    const asset = trade.coin.trim()
    if (!asset || trade.avg_entry <= 0) return

    try {
      const existingMatch = await findMatchingBacktestingTrade({
        userId,
        asset,
        entryPrice: trade.avg_entry,
        stopLoss: trade.stop_loss,
      })

      if (!existingMatch) return

      await updateBacktestingMirrorFromLiveTrade(existingMatch.id, {
        userId,
        tradeDate: trade.trade_date,
        tradeTime: trade.trade_time,
        asset,
        direction: trade.direction,
        entryPrice: trade.avg_entry,
        stopLoss: trade.stop_loss,
        notes: trade.notes,
        outcomeR: nextRMultiple,
      })
    } catch (err) {
      console.error('Backtesting sync failed:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Close Trade #{trade.trade_number}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Exit Price <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.000001"
          value={avgExit || ''}
          onChange={(e) => setAvgExit(parseFloat(e.target.value) || 0)}
          required
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Realised P&L <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          value={realisedPnl || ''}
          onChange={(e) => setRealisedPnl(parseFloat(e.target.value) || 0)}
          required
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Enter positive for win, negative for loss.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Close Trade'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function calculateRMultiple(
  risk: number | null,
  realisedPnl: number,
): number | null {
  if (risk === null || risk <= 0) return null

  if (realisedPnl === 0) return 0

  return realisedPnl / risk
}

function toWinLoss(realisedPnl: number): { realisedWin: number | null; realisedLoss: number | null } {
  if (realisedPnl > 0) {
    return {
      realisedWin: realisedPnl,
      realisedLoss: null,
    }
  }

  if (realisedPnl < 0) {
    return {
      realisedWin: null,
      realisedLoss: Math.abs(realisedPnl),
    }
  }

  return {
    realisedWin: null,
    realisedLoss: null,
  }
}

function getInitialPnl(trade: Trade): number {
  if (trade.realised_win !== null && trade.realised_win > 0) {
    return trade.realised_win
  }

  if (trade.realised_loss !== null && trade.realised_loss > 0) {
    return -trade.realised_loss
  }

  return 0
}
