'use client'

import { useState } from 'react'
import { updateTrade } from '@/services/trade'
import type { Trade } from '@/services/trade'

interface CloseTradeFormProps {
  trade: Trade
  onClose: () => void
  onSuccess: () => void
}

export default function CloseTradeForm({ trade, onClose, onSuccess }: CloseTradeFormProps) {
  const [avgExit, setAvgExit] = useState<number>(trade.avg_exit ?? 0)
  const [realisedLoss, setRealisedLoss] = useState<number>(trade.realised_loss ?? 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await updateTrade(trade.id, {
        avg_exit: avgExit,
        realised_loss: realisedLoss,
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close trade')
    } finally {
      setLoading(false)
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
          Realised Loss <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={realisedLoss || ''}
          onChange={(e) => setRealisedLoss(parseFloat(e.target.value) || 0)}
          required
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
