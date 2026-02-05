'use client'

import { useState, useEffect } from 'react'
import { createTrade, updateTrade } from '@/lib/trades'
import type { Trade, TradeInsert } from '@/lib/types'

interface TradeFormProps {
  trade?: Trade | null // If provided, we're editing. If null, we're creating.
  onClose: () => void
  onSuccess: () => void
  userId: string
}

export default function TradeForm({ trade, onClose, onSuccess, userId }: TradeFormProps) {
  const isEditing = !!trade

  // Form state - initialize with trade data if editing, or empty if creating
  const [formData, setFormData] = useState<TradeInsert>({
    user_id: userId,
    trade_date: trade?.trade_date || new Date().toISOString().split('T')[0], // Today's date
    trade_time: trade?.trade_time || null,
    coin: trade?.coin || '',
    direction: trade?.direction || 'long',
    entry_order_type: trade?.entry_order_type || null,
    avg_entry: trade?.avg_entry || 0,
    stop_loss: trade?.stop_loss || null,
    avg_exit: trade?.avg_exit || null,
    risk: trade?.risk || null,
    expected_loss: trade?.expected_loss || null,
    realised_loss: trade?.realised_loss || null,
    realised_win: trade?.realised_win || null,
    deviation: trade?.deviation || null,
    r_multiple: trade?.r_multiple || null,
    early_exit_reason: trade?.early_exit_reason || null,
    rules: trade?.rules || null,
    system_number: trade?.system_number || null,
    notes: trade?.notes || null,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-detect direction based on entry and stop loss
  useEffect(() => {
    const entry = formData.avg_entry
    const stopLoss = formData.stop_loss

    // Only auto-detect if both entry and stop loss are provided and valid
    if (entry > 0 && stopLoss !== null && stopLoss > 0) {
      const detectedDirection: 'long' | 'short' = entry > stopLoss ? 'long' : 'short'
      
      // Update direction if it's different
      if (formData.direction !== detectedDirection) {
        setFormData(prev => ({ ...prev, direction: detectedDirection }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.avg_entry, formData.stop_loss])

  // Auto-calculate R-multiple based on realized win/loss and risk
  useEffect(() => {
    const risk = formData.risk
    const realisedWin = formData.realised_win
    const realisedLoss = formData.realised_loss

    // Calculate R-multiple if we have risk and either win or loss
    if (risk !== null && risk > 0) {
      let rMultiple: number | null = null

      if (realisedWin !== null && realisedWin > 0) {
        // Positive R-multiple for wins
        rMultiple = realisedWin / risk
      } else if (realisedLoss !== null && realisedLoss > 0) {
        // Negative R-multiple for losses
        rMultiple = -realisedLoss / risk
      }

      // Update R-multiple if it's different
      if (formData.r_multiple !== rMultiple) {
        setFormData(prev => ({ ...prev, r_multiple: rMultiple }))
      }
    } else if (formData.r_multiple !== null) {
      // Clear R-multiple if risk is not set
      setFormData(prev => ({ ...prev, r_multiple: null }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.risk, formData.realised_win, formData.realised_loss])

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isEditing && trade) {
        // Update existing trade
        await updateTrade(trade.id, formData)
      } else {
        // Create new trade
        await createTrade(formData)
      }
      
      // Success! Refresh the trades list
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trade')
    } finally {
      setLoading(false)
    }
  }

  // Helper to update form fields
  function updateField<K extends keyof TradeInsert>(
    field: K,
    value: TradeInsert[K]
  ) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {isEditing ? 'Edit Trade' : 'Add New Trade'}
        </h2>
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

      {/* Basic Trade Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Trade Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.trade_date}
            onChange={(e) => updateField('trade_date', e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Trade Time</label>
          <input
            type="time"
            value={formData.trade_time || ''}
            onChange={(e) => updateField('trade_time', e.target.value || null)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Coin <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.coin}
            onChange={(e) => updateField('coin', e.target.value)}
            required
            placeholder="BTC, ETH, etc."
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Direction <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-500 font-normal">(Auto-detected)</span>
          </label>
          <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700">
            <span className={`font-medium ${
              formData.direction === 'long' ? 'text-green-600' : 'text-red-600'
            }`}>
              {formData.direction.toUpperCase()}
            </span>
          </div>
          {formData.avg_entry > 0 && formData.stop_loss !== null && formData.stop_loss > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {formData.direction === 'long' 
                ? 'Entry is above stop loss → Long position'
                : 'Entry is below stop loss → Short position'}
            </p>
          )}
          {(!formData.avg_entry || formData.avg_entry === 0 || !formData.stop_loss || formData.stop_loss === 0) && (
            <p className="mt-1 text-xs text-gray-400 italic">
              Enter entry price and stop loss to auto-detect
            </p>
          )}
        </div>
      </div>

      {/* Entry Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Avg Entry Price <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.000001"
            value={formData.avg_entry}
            onChange={(e) => updateField('avg_entry', parseFloat(e.target.value) || 0)}
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Stop Loss</label>
          <input
            type="number"
            step="0.000001"
            value={formData.stop_loss || ''}
            onChange={(e) => updateField('stop_loss', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Exit Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Avg Exit Price</label>
          <input
            type="number"
            step="0.000001"
            value={formData.avg_exit || ''}
            onChange={(e) => updateField('avg_exit', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Risk Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.risk || ''}
            onChange={(e) => updateField('risk', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* P&L Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Realised Win</label>
          <input
            type="number"
            step="0.01"
            value={formData.realised_win || ''}
            onChange={(e) => updateField('realised_win', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Realised Loss</label>
          <input
            type="number"
            step="0.01"
            value={formData.realised_loss || ''}
            onChange={(e) => updateField('realised_loss', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* R-Multiple (Auto-calculated) */}
      <div>
        <label className="block text-sm font-medium mb-1">
          R-Multiple
          <span className="ml-2 text-xs text-gray-500 font-normal">(Auto-calculated)</span>
        </label>
        <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-700">
          {formData.r_multiple !== null ? (
            <span className={`font-medium ${
              formData.r_multiple >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formData.r_multiple > 0 ? '+' : ''}{formData.r_multiple.toFixed(2)}R
            </span>
          ) : (
            <span className="text-gray-400 italic">Enter risk and realized win/loss to calculate</span>
          )}
        </div>
        {formData.risk && formData.risk > 0 && (formData.realised_win || formData.realised_loss) && formData.r_multiple !== null && (
          <p className="mt-1 text-xs text-gray-500">
            {formData.r_multiple >= 0 
              ? `Win of $${formData.realised_win || 0} ÷ Risk of $${formData.risk} = ${formData.r_multiple.toFixed(2)}R`
              : `Loss of $${formData.realised_loss || 0} ÷ Risk of $${formData.risk} = ${formData.r_multiple.toFixed(2)}R`}
          </p>
        )}
      </div>

      {/* Additional Fields */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value || null)}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Any additional notes about this trade..."
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : isEditing ? 'Update Trade' : 'Create Trade'}
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
