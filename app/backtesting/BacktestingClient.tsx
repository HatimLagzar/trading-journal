'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import AuthNavbar from '@/app/components/AuthNavbar'
import {
  createBacktestingSession,
  createBacktestingTrade,
  deleteBacktestingSession,
  deleteBacktestingTrade,
  getBacktestingSessions,
  getBacktestingTrades,
  updateBacktestingTrade,
} from '@/services/backtesting'
import { createSystem, getSystems } from '@/services/system'
import Modal from '@/app/trades/Modal'
import ImportBacktestingTradesForm from './ImportBacktestingTradesForm'
import BacktestingTradeChartView from './BacktestingTradeChartView'
import type {
  BacktestingSession,
  BacktestingSessionInsert,
  BacktestingTrade,
  BacktestingTradeInsert,
} from '@/services/backtesting'
import type { System } from '@/services/system'

interface BacktestingClientProps {
  initialUserId: string
  initialSystems: System[]
  initialSessions: BacktestingSession[]
  initialSelectedSessionId: string | null
  initialTrades: BacktestingTrade[]
  initialError: string | null
}

type SessionFormState = {
  name: string
  notes: string
  systemId: string
  newSystemName: string
}

type TradeFormState = {
  trade_date: string
  trade_time: string
  asset: string
  direction: 'long' | 'short'
  entry_price: string
  stop_loss: string
  target_price: string
  outcome_r: string
  notes: string
}

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

type PerformanceEntry = {
  label: string
  totalR: number
}

type PerformanceStats = {
  bestAsset: PerformanceEntry | null
  worstAsset: PerformanceEntry | null
  bestDay: PerformanceEntry | null
  secondBestDay: PerformanceEntry | null
  worstDay: PerformanceEntry | null
  secondWorstDay: PerformanceEntry | null
  bestHour: PerformanceEntry | null
  secondBestHour: PerformanceEntry | null
  worstHour: PerformanceEntry | null
  secondWorstHour: PerformanceEntry | null
}

type DateSortDirection = 'none' | 'asc' | 'desc'
type DirectionFilter = 'all' | 'long' | 'short'

type SessionStats = {
  totalTrades: number
  totalR: number
  winRate: number
  expectedValueR: number
  averageWinR: number
  averageLossR: number
  tradesPerWeek: number
  profitFactor: number | null
}

const initialSessionFormState: SessionFormState = {
  name: '',
  notes: '',
  systemId: '',
  newSystemName: '',
}

const emptyTradeFormState: TradeFormState = {
  trade_date: new Date().toISOString().split('T')[0],
  trade_time: '',
  asset: '',
  direction: 'long',
  entry_price: '',
  stop_loss: '',
  target_price: '',
  outcome_r: '',
  notes: '',
}

export default function BacktestingClient({
  initialUserId,
  initialSystems,
  initialSessions,
  initialSelectedSessionId,
  initialTrades,
  initialError,
}: BacktestingClientProps) {
  const router = useRouter()
  const { isPremium, loading: premiumLoading, redirectToPremium } = usePremiumAccess()

  const [userId] = useState(initialUserId)
  const [systems, setSystems] = useState<System[]>(initialSystems)
  const [sessions, setSessions] = useState<BacktestingSession[]>(initialSessions)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSelectedSessionId)
  const [trades, setTrades] = useState<BacktestingTrade[]>(initialTrades)
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([])
  const [dateSortDirection, setDateSortDirection] = useState<DateSortDirection>('none')
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<DirectionFilter>('all')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [sessionForm, setSessionForm] = useState<SessionFormState>(initialSessionFormState)
  const [savingSession, setSavingSession] = useState(false)

  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState<BacktestingTrade | null>(null)
  const [tradeForm, setTradeForm] = useState<TradeFormState>(() => createInitialTradeFormState())
  const [keepTradeModalOpenOnAdd, setKeepTradeModalOpenOnAdd] = useState(false)
  const [savingTrade, setSavingTrade] = useState(false)
  const aiFileInputRef = useRef<HTMLInputElement>(null)
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  const [awaitingAiPaste, setAwaitingAiPaste] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [openTradeMenuId, setOpenTradeMenuId] = useState<string | null>(null)
  const [chartTrade, setChartTrade] = useState<BacktestingTrade | null>(null)
  const [isChartModalOpen, setIsChartModalOpen] = useState(false)

  useEffect(() => {
    const entry = toNullableNumber(tradeForm.entry_price)
    const stopLoss = toNullableNumber(tradeForm.stop_loss)

    if (entry !== null && entry > 0 && stopLoss !== null && stopLoss > 0) {
      const detectedDirection: 'long' | 'short' = entry > stopLoss ? 'long' : 'short'

      if (tradeForm.direction !== detectedDirection) {
        setTradeForm((prev) => ({
          ...prev,
          direction: detectedDirection,
        }))
      }
    }
  }, [tradeForm.entry_price, tradeForm.stop_loss, tradeForm.direction])

  useEffect(() => {
    const entry = toNullableNumber(tradeForm.entry_price)
    const stopLoss = toNullableNumber(tradeForm.stop_loss)
    const target = toNullableNumber(tradeForm.target_price)

    const outcomeR = calculateOutcomeR(entry, stopLoss, target, tradeForm.direction)

    if (outcomeR === null) {
      if (tradeForm.outcome_r !== '') {
        setTradeForm((prev) => ({
          ...prev,
          outcome_r: '',
        }))
      }
      return
    }

    const formatted = formatOutcomeR(outcomeR)
    if (tradeForm.outcome_r !== formatted) {
      setTradeForm((prev) => ({
        ...prev,
        outcome_r: formatted,
      }))
    }
  }, [tradeForm.entry_price, tradeForm.stop_loss, tradeForm.target_price, tradeForm.direction, tradeForm.outcome_r])

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null
    return sessions.find((session) => session.id === selectedSessionId) ?? null
  }, [selectedSessionId, sessions])

  const selectedSystemName = useMemo(() => {
    if (!selectedSession?.system_id) return 'No system'
    return systems.find((system) => system.id === selectedSession.system_id)?.name ?? 'No system'
  }, [selectedSession, systems])

  const filteredTrades = useMemo(() => {
    if (selectedDirectionFilter === 'all') return trades
    return trades.filter((trade) => trade.direction === selectedDirectionFilter)
  }, [selectedDirectionFilter, trades])

  useEffect(() => {
    setSelectedTradeIds((prev) => prev.filter((id) => filteredTrades.some((trade) => trade.id === id)))
  }, [filteredTrades])

  const selectedTrades = useMemo(() => {
    return filteredTrades.filter((trade) => selectedTradeIds.includes(trade.id))
  }, [filteredTrades, selectedTradeIds])

  const sortedTrades = useMemo(() => {
    if (dateSortDirection === 'none') return filteredTrades

    return [...filteredTrades].sort((a, b) => {
      const aKey = getBacktestingDateTimeSortKey(a.trade_date, a.trade_time)
      const bKey = getBacktestingDateTimeSortKey(b.trade_date, b.trade_time)
      const compare = aKey.localeCompare(bKey)
      return dateSortDirection === 'asc' ? compare : -compare
    })
  }, [dateSortDirection, filteredTrades])

  const statsTrades = selectedTrades.length > 0 ? selectedTrades : filteredTrades

  function toggleDateSortDirection() {
    setDateSortDirection((prev) => {
      if (prev === 'none') return 'asc'
      if (prev === 'asc') return 'desc'
      return 'none'
    })
  }

  function dateSortLabel(): string {
    if (dateSortDirection === 'asc') return 'Date ↑'
    if (dateSortDirection === 'desc') return 'Date ↓'
    return 'Date'
  }

  const sessionStats = useMemo(() => calculateBacktestingSessionStats(statsTrades), [statsTrades])
  const performanceStats = useMemo(() => calculateBacktestingPerformanceStats(statsTrades), [statsTrades])

  const sessionDurationLabel = useMemo(() => {
    if (trades.length === 0) return 'Time spent backtesting: -'

    const timestamps = trades
      .map((trade) => Date.parse(trade.created_at))
      .filter((timestamp) => Number.isFinite(timestamp))

    if (timestamps.length === 0) return 'Time spent backtesting: -'

    const firstCreatedAt = Math.min(...timestamps)
    const lastCreatedAt = Math.max(...timestamps)
    const diffMs = Math.max(0, lastCreatedAt - firstCreatedAt)

    return `Time spent backtesting: ${formatDuration(diffMs)}`
  }, [trades])

  useEffect(() => {
    async function loadSessionTrades() {
      if (!userId || !selectedSessionId) {
        setTrades([])
        return
      }

      try {
        const tradesData = await getBacktestingTrades(userId, selectedSessionId)
        setTrades(tradesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load backtesting trades')
      }
    }

    loadSessionTrades()
  }, [userId, selectedSessionId])

  async function refreshSessions() {
    if (!userId) return

    const sessionsData = await getBacktestingSessions(userId)
    setSessions(sessionsData)

    if (!selectedSessionId && sessionsData[0]) {
      setSelectedSessionId(sessionsData[0].id)
    }

    if (selectedSessionId && !sessionsData.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sessionsData[0]?.id ?? null)
    }
  }

  async function refreshTrades() {
    if (!userId || !selectedSessionId) return
    const tradesData = await getBacktestingTrades(userId, selectedSessionId)
    setTrades(tradesData)
  }

  function openSessionModal() {
    setSessionForm(initialSessionFormState)
    setIsSessionModalOpen(true)
  }

  function closeSessionModal() {
    if (savingSession) return
    setIsSessionModalOpen(false)
    setSessionForm(initialSessionFormState)
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    const sessionName = sessionForm.name.trim()
    if (!sessionName) {
      setError('Session name is required')
      return
    }

    setSavingSession(true)
    setError(null)

    try {
      let systemId: string | null = sessionForm.systemId || null

      const newSystemName = sessionForm.newSystemName.trim()
      if (newSystemName) {
        const createdSystem = await createSystem({
          user_id: userId,
          name: newSystemName,
          entry_rules: null,
          sl_rules: null,
          tp_rules: null,
          description: null,
        })
        systemId = createdSystem.id
      }

      const payload: BacktestingSessionInsert = {
        user_id: userId,
        system_id: systemId,
        name: sessionName,
        notes: sessionForm.notes.trim() || null,
      }

      const created = await createBacktestingSession(payload)

      if (newSystemName) {
        const systemsData = await getSystems(userId)
        setSystems(systemsData)
      }

      await refreshSessions()
      setSelectedSessionId(created.id)
      closeSessionModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setSavingSession(false)
    }
  }

  async function handleDeleteSession(session: BacktestingSession) {
    if (!confirm(`Delete backtesting session "${session.name}"?`)) {
      return
    }

    try {
      await deleteBacktestingSession(session.id)
      await refreshSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
    }
  }

  function openCreateTradeModal() {
    if (!selectedSessionId) return
    setOpenTradeMenuId(null)
    setEditingTrade(null)
    setTradeForm(createInitialTradeFormState())
    setKeepTradeModalOpenOnAdd(false)
    setAiWarnings([])
    setAwaitingAiPaste(false)
    setIsTradeModalOpen(true)
  }

  function openEditTradeModal(trade: BacktestingTrade) {
    setOpenTradeMenuId(null)
    setEditingTrade(trade)
    setTradeForm({
      trade_date: trade.trade_date,
      trade_time: trade.trade_time ? trade.trade_time.substring(0, 5) : '',
      asset: trade.asset,
      direction: trade.direction,
      entry_price: trade.entry_price !== null ? String(trade.entry_price) : '',
      stop_loss: trade.stop_loss !== null ? String(trade.stop_loss) : '',
      target_price: trade.target_price !== null ? String(trade.target_price) : '',
      outcome_r: String(trade.outcome_r),
      notes: trade.notes ?? '',
    })
    setAiWarnings([])
    setKeepTradeModalOpenOnAdd(false)
    setAwaitingAiPaste(false)
    setIsTradeModalOpen(true)
  }

  function closeTradeModal() {
    if (savingTrade) return
    setIsTradeModalOpen(false)
    setEditingTrade(null)
    setTradeForm(createInitialTradeFormState())
    setKeepTradeModalOpenOnAdd(false)
    setAiWarnings([])
    setAwaitingAiPaste(false)
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
      form.append('extraction_context', 'backtesting')

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

  function applyAiExtraction(fields: AiExtractedFields) {
    setTradeForm((prev) => {
      const next = { ...prev }

      if (fields.coin && !isEmptyText(fields.coin)) next.asset = fields.coin
      if (fields.avg_entry !== null) next.entry_price = String(fields.avg_entry)
      if (fields.stop_loss !== null) next.stop_loss = String(fields.stop_loss)
      if (fields.avg_exit !== null) next.target_price = String(fields.avg_exit)
      if (fields.trade_time) next.trade_time = fields.trade_time.substring(0, 5)
      if (fields.trade_date) next.trade_date = fields.trade_date
      if (fields.direction) next.direction = fields.direction

      return next
    })
  }

  useEffect(() => {
    if (!awaitingAiPaste || !isTradeModalOpen) return

    function handleAiPaste(e: ClipboardEvent) {
      const imageFile = extractFirstImageFromClipboard(e)
      if (!imageFile) return

      e.preventDefault()
      void runAiExtraction(imageFile)
    }

    window.addEventListener('paste', handleAiPaste)
    return () => window.removeEventListener('paste', handleAiPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAiPaste, isTradeModalOpen, isPremium, redirectToPremium])

  function openImportModal() {
    if (!selectedSessionId) return
    setIsImportModalOpen(true)
  }

  function handleExportSessionCsv() {
    if (!selectedSession) return

    const csvContent = buildBacktestingSessionCsv({
      trades,
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const sessionSlug = selectedSession.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'session'
    link.href = url
    link.download = `backtesting-${sessionSlug}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function closeImportModal() {
    setIsImportModalOpen(false)
  }

  function handleOpenChart(trade: BacktestingTrade) {
    if (!premiumLoading && !isPremium) {
      redirectToPremium('chart-view')
      return
    }

    setChartTrade(trade)
    setIsChartModalOpen(true)
  }

  function handleCloseChart() {
    setIsChartModalOpen(false)
    setChartTrade(null)
  }

  async function handleSaveTrade(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !selectedSessionId) return

    const asset = tradeForm.asset.trim()
    const outcomeR = Number(tradeForm.outcome_r)

    if (!asset) {
      setError('Asset is required')
      return
    }

    if (!tradeForm.trade_date) {
      setError('Trade date is required')
      return
    }

    if (!Number.isFinite(outcomeR)) {
      setError('Outcome R must be a valid number')
      return
    }

    setSavingTrade(true)
    setError(null)

    try {
      const payload: BacktestingTradeInsert = {
        user_id: userId,
        session_id: selectedSessionId,
        trade_date: tradeForm.trade_date,
        trade_time: tradeForm.trade_time ? `${tradeForm.trade_time}:00` : null,
        asset,
        direction: tradeForm.direction,
        entry_price: toNullableNumber(tradeForm.entry_price),
        stop_loss: toNullableNumber(tradeForm.stop_loss),
        target_price: toNullableNumber(tradeForm.target_price),
        outcome_r: outcomeR,
        notes: tradeForm.notes.trim() || null,
      }

      rememberAsset(asset)

      if (editingTrade) {
        await updateBacktestingTrade(editingTrade.id, payload)
      } else {
        await createBacktestingTrade(payload)
      }

      await refreshTrades()

      const shouldKeepOpen = !editingTrade && keepTradeModalOpenOnAdd
      if (shouldKeepOpen) {
        setTradeForm((prev) => ({
          ...prev,
          entry_price: '',
          stop_loss: '',
          target_price: '',
          outcome_r: '',
        }))
      } else {
        closeTradeModal()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trade')
    } finally {
      setSavingTrade(false)
    }
  }

  async function handleDeleteTrade(trade: BacktestingTrade) {
    if (!confirm('Delete this theoretical trade?')) {
      return
    }

    try {
      await deleteBacktestingTrade(trade.id)
      await refreshTrades()
      setOpenTradeMenuId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete trade')
    }
  }

  function applyLossToTargetPrice() {
    const stopLossValue = tradeForm.stop_loss.trim()
    if (!stopLossValue) return

    setTradeForm((prev) => ({
      ...prev,
      target_price: stopLossValue,
    }))
  }

  function toggleTradeSelection(tradeId: string) {
    setSelectedTradeIds((prev) => {
      if (prev.includes(tradeId)) {
        return prev.filter((id) => id !== tradeId)
      }

      return [...prev, tradeId]
    })
  }

  function areAllTradesSelected(tradeIds: string[]): boolean {
    return tradeIds.length > 0 && tradeIds.every((tradeId) => selectedTradeIds.includes(tradeId))
  }

  function toggleSelectAllTrades(tradeIds: string[]) {
    setSelectedTradeIds((prev) => {
      const allSelected = tradeIds.length > 0 && tradeIds.every((tradeId) => prev.includes(tradeId))

      if (allSelected) {
        return prev.filter((tradeId) => !tradeIds.includes(tradeId))
      }

      const nextSelectedIds = new Set(prev)
      tradeIds.forEach((tradeId) => nextSelectedIds.add(tradeId))
      return Array.from(nextSelectedIds)
    })
  }

  if (loading) return <div className="p-8">Loading backtesting...</div>

  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[92rem]">
        <AuthNavbar current="backtesting" onError={(message) => setError(message || null)} />

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Backtesting</h1>
        </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 border rounded-lg p-4 h-fit">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Sessions</h2>
            <button
              onClick={openSessionModal}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + New Session
            </button>
          </div>

          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">No sessions yet. Create your first backtest session.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const systemName = session.system_id
                  ? systems.find((system) => system.id === session.system_id)?.name ?? 'Unknown system'
                  : 'No system'

                return (
                  <div
                    key={session.id}
                    className={`border rounded p-3 cursor-pointer ${selectedSessionId === session.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm font-medium">{session.name}</p>
                        <p className="text-xs text-gray-500">{systemName}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session)
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </aside>

        <section className="lg:col-span-9">
          {!selectedSession ? (
            <div className="border rounded-lg p-8 text-center text-gray-500">
              Select a session to view theoretical trades.
            </div>
          ) : (
            <>
              <div className="border rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedSession.name}</h2>
                    <p className="text-sm text-gray-600">System: {selectedSystemName}</p>
                    {selectedSession.notes && (
                      <p className="text-sm text-gray-500 mt-1">{selectedSession.notes}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">{sessionDurationLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedDirectionFilter}
                      onChange={(event) => setSelectedDirectionFilter(event.target.value as DirectionFilter)}
                      className="px-3 py-2 text-sm border rounded bg-white"
                    >
                      <option value="all">All Directions</option>
                      <option value="long">Long Trades</option>
                      <option value="short">Short Trades</option>
                    </select>
                    <button
                      onClick={handleExportSessionCsv}
                      className="px-4 py-2 text-sm bg-slate-700 text-white rounded hover:bg-slate-800"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={openImportModal}
                      className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Import Trades
                    </button>
                    <button
                      onClick={openCreateTradeModal}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      + Add Trade
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <MiniStat label="Total Trades" value={sessionStats.totalTrades} />
                  <MiniStat label="Total R" value={sessionStats.totalR.toFixed(2)} />
                  <MiniStat label="Win Rate" value={`${sessionStats.winRate.toFixed(1)}%`} />
                  <MiniStat label="Trades / Week" value={sessionStats.tradesPerWeek.toFixed(2)} />
                  <MiniStat label="EV / Trade (R)" value={`${sessionStats.expectedValueR.toFixed(2)}R`} />
                  <MiniStat
                    label="Avg Win (R)"
                    value={`${sessionStats.averageWinR >= 0 ? '+' : ''}${sessionStats.averageWinR.toFixed(2)}R`}
                    valueClassName="text-green-600"
                  />
                  <MiniStat
                    label="Avg Loss (R)"
                    value={`${sessionStats.averageLossR >= 0 ? '+' : ''}${sessionStats.averageLossR.toFixed(2)}R`}
                    valueClassName="text-red-600"
                  />
                  <MiniStat
                    label="Profit Factor"
                    value={
                      sessionStats.profitFactor === null
                        ? '-'
                        : Number.isFinite(sessionStats.profitFactor)
                          ? sessionStats.profitFactor.toFixed(2)
                          : '∞'
                    }
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <BestPerformanceCard stats={performanceStats} />
                  <WorstPerformanceCard stats={performanceStats} />
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-end">
                  {sortedTrades.length > 0 && (
                    <button
                      onClick={() => toggleSelectAllTrades(sortedTrades.map((trade) => trade.id))}
                      className="text-xs text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
                    >
                      {areAllTradesSelected(sortedTrades.map((trade) => trade.id)) ? 'Unselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left" />
                      <th className="px-3 py-2 text-left">
                        <button
                          type="button"
                          onClick={toggleDateSortDirection}
                          className="cursor-pointer text-left hover:underline"
                        >
                          {dateSortLabel()}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left">Asset</th>
                      <th className="px-3 py-2 text-left">Dir</th>
                      <th className="px-3 py-2 text-right">Entry</th>
                      <th className="px-3 py-2 text-right">SL</th>
                      <th className="px-3 py-2 text-right">TP</th>
                      <th className="px-3 py-2 text-right">Profit (R)</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTrades.map((trade) => (
                      <tr key={trade.id} className="border-t">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedTradeIds.includes(trade.id)}
                            onChange={() => toggleTradeSelection(trade.id)}
                          />
                        </td>
                        <td className="px-3 py-2">{formatDateAndTime(trade.trade_date, trade.trade_time)}</td>
                        <td className="px-3 py-2">{trade.asset}</td>
                        <td className="px-3 py-2 uppercase">{trade.direction}</td>
                        <td className="px-3 py-2 text-right">{trade.entry_price ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{trade.stop_loss ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{trade.target_price ?? '-'}</td>
                        <td className={`px-3 py-2 text-right font-medium ${trade.outcome_r >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {`${trade.outcome_r >= 0 ? '+' : ''}${trade.outcome_r.toFixed(2)}R`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end">
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setOpenTradeMenuId((prev) => (prev === trade.id ? null : trade.id))
                                }}
                                className="px-2 py-1 text-xs text-gray-800 hover:text-black cursor-pointer"
                                aria-expanded={openTradeMenuId === trade.id}
                                aria-haspopup="menu"
                              >
                                ⋯
                              </button>
                              {openTradeMenuId === trade.id && (
                                <div className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                                  <button
                                    onClick={() => {
                                      setOpenTradeMenuId(null)
                                      handleOpenChart(trade)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50"
                                    role="menuitem"
                                  >
                                    {!premiumLoading && !isPremium ? 'Chart (Premium)' : 'Chart'}
                                  </button>
                                  <button
                                    onClick={() => openEditTradeModal(trade)}
                                    className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50"
                                    role="menuitem"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTrade(trade)}
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                    role="menuitem"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sortedTrades.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                          No theoretical trades yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal isOpen={isSessionModalOpen} onClose={closeSessionModal}>
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">New Backtesting Session</h2>
            <button type="button" onClick={closeSessionModal} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Session Name</label>
            <input
              type="text"
              value={sessionForm.name}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g. London Breakout - Jan Sample"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Use Existing System (optional)</label>
            <select
              value={sessionForm.systemId}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, systemId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">No system</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>{system.name}</option>
              ))}
            </select>
          </div>

          {!sessionForm.systemId && (
            <div>
              <label className="block text-sm font-medium mb-1">Or Create New System</label>
              <input
                type="text"
                value={sessionForm.newSystemName}
                onChange={(e) => setSessionForm((prev) => ({ ...prev, newSystemName: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g. Reversal Model"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={sessionForm.notes}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingSession}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingSession ? 'Creating...' : 'Create Session'}
            </button>
            <button
              type="button"
              onClick={closeSessionModal}
              disabled={savingSession}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isTradeModalOpen} onClose={closeTradeModal}>
        <form onSubmit={handleSaveTrade} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{editingTrade ? 'Edit Theoretical Trade' : 'Add Theoretical Trade'}</h2>
            <button type="button" onClick={closeTradeModal} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={tradeForm.trade_date}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, trade_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time</label>
              <input
                type="time"
                value={tradeForm.trade_time}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, trade_time: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Asset</label>
              <input
                type="text"
                value={tradeForm.asset}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, asset: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Direction</label>
              <select
                value={tradeForm.direction}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, direction: e.target.value as 'long' | 'short' }))}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Entry</label>
              <input
                type="number"
                step="0.000001"
                value={tradeForm.entry_price}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, entry_price: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SL</label>
              <input
                type="number"
                step="0.000001"
                value={tradeForm.stop_loss}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, stop_loss: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">TP</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.000001"
                  value={tradeForm.target_price}
                  onChange={(e) => setTradeForm((prev) => ({ ...prev, target_price: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={applyLossToTargetPrice}
                  disabled={!tradeForm.stop_loss.trim()}
                  className="cursor-pointer rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Loss
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Profit (R)</label>
            <input
              type="number"
              step="0.01"
              value={tradeForm.outcome_r}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, outcome_r: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-calculated from entry, stop loss, target, and direction.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={tradeForm.notes}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          {!editingTrade && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={keepTradeModalOpenOnAdd}
                onChange={(e) => setKeepTradeModalOpenOnAdd(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              Keep modal open after adding (clear only Entry/SL/TP)
            </label>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingTrade || aiExtracting}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {savingTrade ? 'Saving...' : editingTrade ? 'Update Trade' : 'Add Trade'}
            </button>
            <button
              type="button"
              onClick={closeTradeModal}
              disabled={savingTrade}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {userId && selectedSessionId && (
        <Modal isOpen={isImportModalOpen} onClose={closeImportModal}>
          <ImportBacktestingTradesForm
            userId={userId}
            sessionId={selectedSessionId}
            onClose={closeImportModal}
            onSuccess={refreshTrades}
          />
        </Modal>
      )}

      {chartTrade && selectedSession && (
        <Modal
          isOpen={isChartModalOpen}
          onClose={handleCloseChart}
          closeOnOverlayClick={false}
          contentClassName="max-w-[75vw]"
        >
          <BacktestingTradeChartView
            trade={chartTrade}
            sessionName={selectedSession.name}
            systemLabel={selectedSystemName}
            onClose={handleCloseChart}
          />
        </Modal>
      )}
      </div>
    </div>
  )
}

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const numberValue = Number(trimmed)
  return Number.isFinite(numberValue) ? numberValue : null
}

function createInitialTradeFormState(): TradeFormState {
  return {
    ...emptyTradeFormState,
    asset: getStoredAsset(),
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

function isEmptyText(value: string | null): boolean {
  return value === null || value.trim() === ''
}

function formatDateAndTime(date: string, time: string | null): string {
  if (!time) return date
  return `${date} ${time.substring(0, 5)}`
}

function getBacktestingDateTimeSortKey(date: string, time: string | null): string {
  const normalizedDate = normalizeTradeDate(date) ?? '9999-12-31'
  const normalizedTime = normalizeDisplayTime(time)
  return `${normalizedDate}T${normalizedTime}`
}

function normalizeDisplayTime(tradeTime: string | null): string {
  if (!tradeTime) return '00:00:00'

  const trimmed = tradeTime.trim()
  if (!trimmed) return '00:00:00'

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }

  return '00:00:00'
}

function MiniStat({
  label,
  value,
  valueClassName = '',
}: {
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function BestPerformanceCard({ stats }: { stats: PerformanceStats }) {
  const rows = [
    { label: 'Asset', data: stats.bestAsset },
    { label: 'Day #1', data: stats.bestDay },
    { label: 'Day #2', data: stats.secondBestDay },
    { label: 'Time #1', data: stats.bestHour },
    { label: 'Time #2', data: stats.secondBestHour },
  ]

  return (
    <div className="border rounded p-3">
      <p className="text-xs text-gray-500 mb-2">Best Performers (R)</p>
      <div className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-gray-600">{row.label}</span>
            {row.data ? (
              <span className="text-green-600 font-medium text-right">
                {`${row.data.label} (${formatSignedR(row.data.totalR)})`}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WorstPerformanceCard({ stats }: { stats: PerformanceStats }) {
  const rows = [
    { label: 'Asset', data: stats.worstAsset },
    { label: 'Day #1', data: stats.worstDay },
    { label: 'Day #2', data: stats.secondWorstDay },
    { label: 'Time #1', data: stats.worstHour },
    { label: 'Time #2', data: stats.secondWorstHour },
  ]

  return (
    <div className="border rounded p-3">
      <p className="text-xs text-gray-500 mb-2">Worst Performers (R)</p>
      <div className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-gray-600">{row.label}</span>
            {row.data ? (
              <span className="text-red-600 font-medium text-right">
                {`${row.data.label} (${formatSignedR(row.data.totalR)})`}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatSignedR(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0')
    const month = dmyMatch[2].padStart(2, '0')
    const year = dmyMatch[3]
    return `${year}-${month}-${day}`
  }

  const fallback = new Date(trimmed)
  if (Number.isNaN(fallback.getTime())) return null
  return toLocalDateString(fallback)
}

function getWeekdayLabelFromTradeDate(tradeDate: string): string | null {
  const normalizedDate = normalizeTradeDate(tradeDate)
  if (!normalizedDate) return null

  const date = new Date(`${normalizedDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

function getHourLabelFromTradeTime(tradeTime: string | null): string | null {
  if (!tradeTime) return null

  const trimmed = tradeTime.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2})/)
  if (!match) return null

  const hour = Number(match[1])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null

  return `${String(hour).padStart(2, '0')}:00`
}

function getMonthWeekKeyFromTradeDate(tradeDate: string): string | null {
  const normalizedDate = normalizeTradeDate(tradeDate)
  if (!normalizedDate) return null

  const date = new Date(`${normalizedDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dayOfMonth = date.getUTCDate()
  const weekInMonth = Math.floor((dayOfMonth - 1) / 7) + 1

  return `${year}-${month}-W${weekInMonth}`
}

function calculateBacktestingSessionStats(trades: BacktestingTrade[]): SessionStats {
  const totalTrades = trades.length
  const totalR = trades.reduce((sum, trade) => sum + trade.outcome_r, 0)
  const winningTrades = trades.filter((trade) => trade.outcome_r > 0)
  const losingTrades = trades.filter((trade) => trade.outcome_r < 0)
  const monthWeekBuckets = new Set<string>()

  trades.forEach((trade) => {
    const monthWeekKey = getMonthWeekKeyFromTradeDate(trade.trade_date)
    if (monthWeekKey) {
      monthWeekBuckets.add(monthWeekKey)
    }
  })

  const wins = winningTrades.length
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
  const totalPositiveR = winningTrades.reduce((sum, trade) => sum + trade.outcome_r, 0)
  const totalNegativeR = losingTrades.reduce((sum, trade) => sum + trade.outcome_r, 0)
  const totalNegativeRAbs = Math.abs(totalNegativeR)

  const expectedValueR = totalTrades > 0 ? totalR / totalTrades : 0
  const averageWinR = winningTrades.length > 0 ? totalPositiveR / winningTrades.length : 0
  const averageLossR = losingTrades.length > 0 ? totalNegativeR / losingTrades.length : 0
  const tradesPerWeek = monthWeekBuckets.size > 0 ? totalTrades / monthWeekBuckets.size : 0
  const profitFactor = totalNegativeRAbs > 0
    ? totalPositiveR / totalNegativeRAbs
    : totalPositiveR > 0
      ? Number.POSITIVE_INFINITY
      : null

  return {
    totalTrades,
    totalR,
    winRate,
    expectedValueR,
    averageWinR,
    averageLossR,
    tradesPerWeek,
    profitFactor,
  }
}

function calculateBacktestingPerformanceStats(trades: BacktestingTrade[]): PerformanceStats {
  const assetTotals = new Map<string, number>()
  const weekdayTotals = new Map<string, number>()
  const hourTotals = new Map<string, number>()

  trades.forEach((trade) => {
    const assetKey = trade.asset?.trim() || 'Unknown'
    assetTotals.set(assetKey, (assetTotals.get(assetKey) ?? 0) + trade.outcome_r)

    const weekdayKey = getWeekdayLabelFromTradeDate(trade.trade_date)
    if (weekdayKey) {
      weekdayTotals.set(weekdayKey, (weekdayTotals.get(weekdayKey) ?? 0) + trade.outcome_r)
    }

    const hourKey = getHourLabelFromTradeTime(trade.trade_time)
    if (hourKey) {
      hourTotals.set(hourKey, (hourTotals.get(hourKey) ?? 0) + trade.outcome_r)
    }
  })

  function pickTopTwo(
    map: Map<string, number>,
  ): { first: PerformanceEntry | null; second: PerformanceEntry | null } {
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)

    return {
      first: entries[0] ? { label: entries[0][0], totalR: entries[0][1] } : null,
      second: entries[1] ? { label: entries[1][0], totalR: entries[1][1] } : null,
    }
  }

  function pickBottomTwo(
    map: Map<string, number>,
  ): { first: PerformanceEntry | null; second: PerformanceEntry | null } {
    const entries = Array.from(map.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)

    return {
      first: entries[0] ? { label: entries[0][0], totalR: entries[0][1] } : null,
      second: entries[1] ? { label: entries[1][0], totalR: entries[1][1] } : null,
    }
  }

  const bestAssets = pickTopTwo(assetTotals)
  const worstAssets = pickBottomTwo(assetTotals)
  const bestDays = pickTopTwo(weekdayTotals)
  const worstDays = pickBottomTwo(weekdayTotals)
  const bestHours = pickTopTwo(hourTotals)
  const worstHours = pickBottomTwo(hourTotals)

  return {
    bestAsset: bestAssets.first,
    worstAsset: worstAssets.first,
    bestDay: bestDays.first,
    secondBestDay: bestDays.second,
    worstDay: worstDays.first,
    secondWorstDay: worstDays.second,
    bestHour: bestHours.first,
    secondBestHour: bestHours.second,
    worstHour: worstHours.first,
    secondWorstHour: worstHours.second,
  }
}

function buildBacktestingSessionCsv(input: {
  trades: BacktestingTrade[]
}): string {
  const delimiter = ';'

  const rows: string[][] = [
    [
      'Trade Date',
      'Trade Time',
      'Asset',
      'Direction',
      'Entry Price',
      'Stop Loss',
      'Target Price',
      'Outcome (R)',
      'Notes',
    ],
  ]

  input.trades.forEach((trade) => {
    rows.push([
      trade.trade_date,
      trade.trade_time ?? '',
      trade.asset,
      trade.direction,
      formatCsvNumber(trade.entry_price),
      formatCsvNumber(trade.stop_loss),
      formatCsvNumber(trade.target_price),
      formatCsvNumber(trade.outcome_r),
      trade.notes ?? '',
    ])
  })

  const csvRows = rows.map((row) => row.map((value) => toCsvCell(value, delimiter)).join(delimiter))

  return ['sep=;', ...csvRows].join('\r\n')
}

function formatCsvNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  return String(value).replace('.', ',')
}

function toCsvCell(value: string, delimiter: string): string {
  const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const needsQuotes = new RegExp(`${escapedDelimiter}|"|\n`).test(value)
  if (!needsQuotes) return value
  return `"${value.replace(/"/g, '""')}"`
}

function formatDuration(milliseconds: number): string {
  if (milliseconds <= 0) return 'less than 1 minute'

  const totalMinutes = Math.floor(milliseconds / 60000)
  if (totalMinutes < 60) {
    return `${totalMinutes}m`
  }

  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.join(' ')
}

function calculateOutcomeR(
  entry: number | null,
  stopLoss: number | null,
  target: number | null,
  direction: 'long' | 'short',
): number | null {
  if (entry === null || stopLoss === null || target === null) return null

  if (direction === 'long') {
    const risk = entry - stopLoss
    if (risk <= 0) return null
    const reward = target - entry
    return reward / risk
  }

  const risk = stopLoss - entry
  if (risk <= 0) return null
  const reward = entry - target
  return reward / risk
}

function formatOutcomeR(value: number): string {
  return Number(value.toFixed(4)).toString()
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
