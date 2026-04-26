'use client'

import { useState, useEffect, useRef } from 'react'
import { createTrade, updateTrade } from '@/services/trade'
import {
  createBacktestingMirrorFromLiveTrade,
  findMatchingBacktestingTrade,
  getBacktestingSessions,
  updateBacktestingMirrorFromLiveTrade,
} from '@/services/backtesting'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import { getSystems, getSubSystems } from '@/services/system'
import {
  uploadScreenshot,
  getTradeScreenshots,
  getScreenshotUrl,
  deleteScreenshot,
} from '@/services/upload'
import type { Trade, TradeInsert, TradeScreenshot } from '@/services/trade'
import type { System, SubSystem } from '@/services/system'
import type { BacktestingSession } from '@/services/backtesting'

const LAST_RISK_STORAGE_KEY = 'trade_form_last_risk'
const LAST_ASSET_STORAGE_KEY = 'trade_form_last_asset'

type AiExtractedFields = {
  coin: string | null
  direction: 'long' | 'short' | null
  avg_entry: number | null
  stop_loss: number | null
  avg_exit: number | null
  risk: number | null
  r_multiple: number | null
  trade_date: string | null
  trade_time: string | null
  notes: null
}

type AiExtractionResponse = {
  fields: AiExtractedFields
  warnings: string[]
}

interface TradeFormProps {
  trade?: Trade | null // If provided, we're editing. If null, we're creating.
  onClose: () => void
  onSuccess: () => void
  userId: string
}

export default function TradeForm({ trade, onClose, onSuccess, userId }: TradeFormProps) {
  const isEditing = !!trade
  const storedRisk = getStoredRisk()
  const storedAsset = getStoredAsset()

  // Form state - initialize with trade data if editing, or empty if creating
  const [formData, setFormData] = useState<TradeInsert>({
    user_id: userId,
    trade_date: trade?.trade_date || new Date().toISOString().split('T')[0], // Today's date
    trade_time: trade?.trade_time || null,
    coin: trade?.coin || (!isEditing ? storedAsset : ''),
    direction: trade?.direction || 'long',
    entry_order_type: trade?.entry_order_type || null,
    avg_entry: trade?.avg_entry || 0,
    stop_loss: trade?.stop_loss || null,
    avg_exit: trade?.avg_exit || null,
    risk: trade?.risk ?? (!isEditing ? storedRisk : null),
    expected_loss: trade?.expected_loss || null,
    realised_loss: trade?.realised_loss || null,
    realised_win: trade?.realised_win || null,
    deviation: trade?.deviation || null,
    r_multiple: trade?.r_multiple || null,
    early_exit_reason: trade?.early_exit_reason || null,
    rules: trade?.rules || null,
    system_number: trade?.system_number || null,
    system_id: trade?.system_id || null,
    sub_system_id: trade?.sub_system_id || null,
    notes: trade?.notes || null,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [subSystems, setSubSystems] = useState<SubSystem[]>([])
  const [backtestingSessions, setBacktestingSessions] = useState<BacktestingSession[]>([])
  const [selectedBacktestingSessionId, setSelectedBacktestingSessionId] = useState('')
  const { isPremium, redirectToPremium } = usePremiumAccess()

  // Screenshot state
  const [existingScreenshots, setExistingScreenshots] = useState<TradeScreenshot[]>([])
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({})
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const aiFileInputRef = useRef<HTMLInputElement>(null)
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [awaitingAiPaste, setAwaitingAiPaste] = useState(false)

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

  useEffect(() => {
    if (formData.risk === null || formData.risk <= 0) return

    try {
      window.localStorage.setItem(LAST_RISK_STORAGE_KEY, String(formData.risk))
    } catch {
      // Ignore storage failures
    }
  }, [formData.risk])

  // Load existing screenshots when editing
  useEffect(() => {
    if (isEditing && trade) {
      getTradeScreenshots(trade.id).then(async (screenshots) => {
        setExistingScreenshots(screenshots)
        // Get signed URLs for each screenshot
        const urls: Record<string, string> = {}
        for (const s of screenshots) {
          urls[s.id] = await getScreenshotUrl(s.storage_path)
        }
        setScreenshotUrls(urls)
      })
    }
  }, [isEditing, trade])

  // Load systems
  useEffect(() => {
    getSystems(userId).then(setSystems).catch(console.error)
  }, [userId])

  // Load backtesting sessions
  useEffect(() => {
    getBacktestingSessions(userId).then(setBacktestingSessions).catch(console.error)
  }, [userId])

  // Load sub-systems when system changes
  useEffect(() => {
    if (formData.system_id) {
      getSubSystems(userId, formData.system_id).then(setSubSystems).catch(console.error)
    } else {
      setSubSystems([])
    }
  }, [userId, formData.system_id])

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      pendingPreviews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [pendingPreviews])

  function addPendingFiles(files: File[]) {
    if (files.length === 0) return

    if (!isPremium) {
      redirectToPremium('screenshots')
      return
    }

    setPendingFiles(prev => [...prev, ...files])

    const newPreviews = files.map(file => URL.createObjectURL(file))
    setPendingPreviews(prev => [...prev, ...newPreviews])
  }

  // Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    addPendingFiles(files)

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAiScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    await runAiExtraction(file)

    if (aiFileInputRef.current) {
      aiFileInputRef.current.value = ''
    }
  }

  async function runAiExtraction(file: File) {
    if (!isPremium) {
      redirectToPremium('ai-screenshot-import')
      return
    }

    setAiExtracting(true)
    setAwaitingAiPaste(false)
    setAiWarnings([])
    setError(null)

    try {
      const form = new FormData()
      form.append('image', file)
      form.append('filename', file.name)
      form.append('mime_type', file.type)
      form.append('file_size', String(file.size))

      const response = await fetch('/api/ai/extract-trade-from-image', {
        method: 'POST',
        body: form,
      })

      const payload = await response.json() as { error?: string } & Partial<AiExtractionResponse>
      if (!response.ok || !payload.fields) {
        throw new Error(payload.error || 'Failed to extract trade fields from screenshot')
      }

      applyAiExtraction(payload.fields)
      setAiWarnings(payload.warnings ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze screenshot')
    } finally {
      setAiExtracting(false)
    }
  }

  useEffect(() => {
    if (!awaitingAiPaste) return

    function handleAiPaste(e: ClipboardEvent) {
      const imageFile = extractFirstImageFromClipboard(e)
      if (!imageFile) return

      e.preventDefault()
      void runAiExtraction(imageFile)
    }

    window.addEventListener('paste', handleAiPaste)
    return () => window.removeEventListener('paste', handleAiPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAiPaste, isPremium, redirectToPremium])

  function applyAiExtraction(fields: AiExtractedFields) {
    setFormData((prev) => {
      const next = { ...prev }

      if (fields.coin && !isEmptyText(fields.coin)) next.coin = fields.coin
      if (fields.avg_entry !== null) next.avg_entry = fields.avg_entry
      if (fields.stop_loss !== null) next.stop_loss = fields.stop_loss
      if (fields.avg_exit !== null) next.avg_exit = fields.avg_exit
      if (fields.risk !== null) next.risk = fields.risk
      if (fields.r_multiple !== null) next.r_multiple = fields.r_multiple
      if (fields.trade_time) next.trade_time = fields.trade_time
      if (fields.trade_date) next.trade_date = fields.trade_date
      if (fields.direction) next.direction = fields.direction

      return next
    })
  }

  function isEmptyText(value: string | null): boolean {
    return value === null || value.trim() === ''
  }

  // Remove pending file
  function removePendingFile(index: number) {
    URL.revokeObjectURL(pendingPreviews[index])
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
    setPendingPreviews(prev => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (awaitingAiPaste) return

      const clipboardItems = Array.from(e.clipboardData?.items || [])
      const imageFiles = clipboardItems
        .filter(item => item.type.startsWith('image/'))
        .map((item, index) => {
          const file = item.getAsFile()
          if (!file) return null

          const extension = file.type.split('/')[1] || 'png'
          return new File([file], `clipboard-${Date.now()}-${index}.${extension}`, {
            type: file.type,
          })
        })
        .filter((file): file is File => file !== null)

      if (imageFiles.length === 0) return

      if (!isPremium) {
        redirectToPremium('screenshots')
        return
      }

      e.preventDefault()
      addPendingFiles(imageFiles)
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [awaitingAiPaste, isPremium, redirectToPremium])

  // Delete existing screenshot
  async function handleDeleteScreenshot(screenshot: TradeScreenshot) {
    try {
      await deleteScreenshot(screenshot)
      setExistingScreenshots(prev => prev.filter(s => s.id !== screenshot.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete screenshot')
    }
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let tradeId: string

      if (isEditing && trade) {
        // Update existing trade
        await updateTrade(trade.id, formData)
        tradeId = trade.id
      } else {
        // Create new trade
        const newTrade = await createTrade(formData)
        tradeId = newTrade.id
      }

      rememberAsset(formData.coin)

      await syncBacktestingMirror()

      // Upload any pending screenshots
      if (pendingFiles.length > 0) {
        setUploadingScreenshots(true)
        for (const file of pendingFiles) {
          await uploadScreenshot(userId, tradeId, file)
        }
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

  async function syncBacktestingMirror() {
    const asset = formData.coin.trim()
    if (!asset || formData.avg_entry <= 0) return

    const mirrorBasePayload = {
      userId,
      tradeDate: formData.trade_date,
      tradeTime: formData.trade_time,
      asset,
      direction: formData.direction,
      entryPrice: formData.avg_entry,
      stopLoss: formData.stop_loss,
      notes: formData.notes,
      outcomeR: formData.r_multiple,
    }

    const lookupInput = {
      userId,
      asset,
      entryPrice: formData.avg_entry,
      stopLoss: formData.stop_loss,
    }

    try {
      if (!isEditing && selectedBacktestingSessionId) {
        if (!isPremium) {
          redirectToPremium('mirror-live-trades')
          return
        }

        await createBacktestingMirrorFromLiveTrade({
          ...mirrorBasePayload,
          sessionId: selectedBacktestingSessionId,
        })
        return
      }

      const preferredMatch = selectedBacktestingSessionId
        ? await findMatchingBacktestingTrade({
          ...lookupInput,
          sessionId: selectedBacktestingSessionId,
        })
        : null

      const existingMatch = preferredMatch ?? await findMatchingBacktestingTrade(lookupInput)

      if (existingMatch) {
        await updateBacktestingMirrorFromLiveTrade(existingMatch.id, mirrorBasePayload)
        return
      }

      if (selectedBacktestingSessionId) {
        if (!isPremium) {
          redirectToPremium('mirror-live-trades')
          return
        }

        await createBacktestingMirrorFromLiveTrade({
          ...mirrorBasePayload,
          sessionId: selectedBacktestingSessionId,
        })
      }
    } catch (err) {
      console.error('Backtesting sync failed:', err)
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
      <div className="mb-4 flex cursor-move select-none justify-between items-center" data-modal-drag-handle="live-trade-form">
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

      {/* AI screenshot quick actions */}
      <div>
        <p className="block text-sm font-medium mb-2">AI Trade Prefill</p>

        <input
          ref={aiFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleAiScreenshotSelect}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                redirectToPremium('ai-screenshot-import')
                return
              }
              aiFileInputRef.current?.click()
            }}
            disabled={aiExtracting}
            className="rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {aiExtracting
              ? 'Analyzing...'
              : (!isPremium ? 'Upload for AI (Premium)' : 'Upload for AI')}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPremium) {
                redirectToPremium('ai-screenshot-import')
                return
              }
              setAwaitingAiPaste((prev) => !prev)
            }}
            disabled={aiExtracting}
            className={`rounded-lg border py-2 text-sm font-medium disabled:opacity-60 ${
              awaitingAiPaste
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {!isPremium
              ? 'Paste for AI (Premium)'
              : awaitingAiPaste
                ? 'Waiting for paste...'
                : 'Paste for AI'}
          </button>
        </div>

        {aiWarnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">AI warnings</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {aiWarnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

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

      {/* System Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">System</label>
          <select
            value={formData.system_id || ''}
            onChange={(e) => {
              updateField('system_id', e.target.value || null)
              updateField('sub_system_id', null)
            }}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No System</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sub-System</label>
          <select
            value={formData.sub_system_id || ''}
            onChange={(e) => updateField('sub_system_id', e.target.value || null)}
            disabled={!formData.system_id}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">No Sub-System</option>
            {subSystems.map((subSystem) => (
              <option key={subSystem.id} value={subSystem.id}>
                {subSystem.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Backtesting Session</label>
        <select
          value={selectedBacktestingSessionId}
          onChange={(e) => {
            const nextValue = e.target.value
            if (nextValue && !isPremium) {
              redirectToPremium('mirror-live-trades')
              return
            }
            setSelectedBacktestingSessionId(nextValue)
          }}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">No Backtesting Session</option>
          {backtestingSessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {isEditing
            ? 'Pick a session to create or prioritize backtesting sync for this trade.'
            : 'Optionally mirror this live trade into a backtesting session.'}
        </p>
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
            disabled={aiExtracting}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Stop Loss</label>
          <input
            type="number"
            step="0.000001"
            value={formData.stop_loss || ''}
            onChange={(e) => updateField('stop_loss', e.target.value ? parseFloat(e.target.value) : null)}
            disabled={aiExtracting}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

      {/* Screenshots */}
      <div>
        <label className="block text-sm font-medium mb-2">Screenshots</label>

        {/* Existing screenshots (when editing) */}
        {existingScreenshots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {existingScreenshots.map(screenshot => (
              <div key={screenshot.id} className="relative group">
                <img
                  src={screenshotUrls[screenshot.id]}
                  alt={screenshot.filename}
                  className="w-full h-24 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteScreenshot(screenshot)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  X
                </button>
                <p className="text-xs text-gray-500 truncate">{screenshot.filename}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending files preview */}
        {pendingPreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {pendingPreviews.map((preview, index) => (
              <div key={preview} className="relative group">
                <img
                  src={preview}
                  alt={`Pending ${index + 1}`}
                  className="w-full h-24 object-cover rounded border border-blue-300"
                />
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  X
                </button>
                <p className="text-xs text-blue-500 truncate">{pendingFiles[index].name}</p>
              </div>
            ))}
          </div>
        )}

        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => {
            if (!isPremium) {
              redirectToPremium('screenshots')
              return
            }
            fileInputRef.current?.click()
          }}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + Add Screenshots
        </button>
        <p className="mt-2 text-xs text-gray-500">
          You can also paste an image from your clipboard with Ctrl+V or Cmd+V.
        </p>
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
          {uploadingScreenshots ? 'Uploading images...' : loading ? 'Saving...' : isEditing ? 'Update Trade' : 'Create Trade'}
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

function extractFirstImageFromClipboard(event: ClipboardEvent): File | null {
  const clipboardItems = Array.from(event.clipboardData?.items || [])

  for (let index = 0; index < clipboardItems.length; index += 1) {
    const item = clipboardItems[index]
    if (!item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (!file) continue

    const extension = file.type.split('/')[1] || 'png'
    return new File([file], `ai-paste-${Date.now()}.${extension}`, {
      type: file.type,
    })
  }

  return null
}

function getStoredRisk(): number | null {
  if (typeof window === 'undefined') return null

  try {
    const rawValue = window.localStorage.getItem(LAST_RISK_STORAGE_KEY)
    if (!rawValue) return null

    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  } catch {
    return null
  }
}

function getStoredAsset(): string {
  if (typeof window === 'undefined') return ''

  try {
    const rawValue = window.localStorage.getItem(LAST_ASSET_STORAGE_KEY)
    return rawValue?.trim().toUpperCase() || ''
  } catch {
    return ''
  }
}

function rememberAsset(value: string): void {
  if (typeof window === 'undefined') return

  const normalized = value.trim().toUpperCase()
  if (!normalized) return

  try {
    window.localStorage.setItem(LAST_ASSET_STORAGE_KEY, normalized)
  } catch {
    // Ignore storage failures
  }
}
