'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
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
import type {
  BacktestingSession,
  BacktestingSessionInsert,
  BacktestingTrade,
  BacktestingTradeInsert,
} from '@/services/backtesting'
import type { System } from '@/services/system'
import type { User } from '@supabase/supabase-js'

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

const initialSessionFormState: SessionFormState = {
  name: '',
  notes: '',
  systemId: '',
  newSystemName: '',
}

const initialTradeFormState: TradeFormState = {
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

export default function BacktestingPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [sessions, setSessions] = useState<BacktestingSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [trades, setTrades] = useState<BacktestingTrade[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [sessionForm, setSessionForm] = useState<SessionFormState>(initialSessionFormState)
  const [savingSession, setSavingSession] = useState(false)

  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState<BacktestingTrade | null>(null)
  const [tradeForm, setTradeForm] = useState<TradeFormState>(initialTradeFormState)
  const [savingTrade, setSavingTrade] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [openTradeMenuId, setOpenTradeMenuId] = useState<string | null>(null)

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

  const sessionStats = useMemo(() => {
    const totalTrades = trades.length
    const totalR = trades.reduce((sum, trade) => sum + trade.outcome_r, 0)
    const wins = trades.filter((trade) => trade.outcome_r > 0).length
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0

    const totalPositiveR = trades
      .filter((trade) => trade.outcome_r > 0)
      .reduce((sum, trade) => sum + trade.outcome_r, 0)

    const totalNegativeRAbs = Math.abs(
      trades
        .filter((trade) => trade.outcome_r < 0)
        .reduce((sum, trade) => sum + trade.outcome_r, 0),
    )

    const expectedValueR = totalTrades > 0 ? totalR / totalTrades : 0
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
      profitFactor,
    }
  }, [trades])

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      try {
        const [systemsData, sessionsData] = await Promise.all([
          getSystems(user.id),
          getBacktestingSessions(user.id),
        ])

        setSystems(systemsData)
        setSessions(sessionsData)

        const defaultSessionId = sessionsData[0]?.id ?? null
        setSelectedSessionId(defaultSessionId)

        if (defaultSessionId) {
          const tradesData = await getBacktestingTrades(user.id, defaultSessionId)
          setTrades(tradesData)
        } else {
          setTrades([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load backtesting data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  useEffect(() => {
    async function loadSessionTrades() {
      if (!user || !selectedSessionId) {
        setTrades([])
        return
      }

      try {
        const tradesData = await getBacktestingTrades(user.id, selectedSessionId)
        setTrades(tradesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load backtesting trades')
      }
    }

    loadSessionTrades()
  }, [user, selectedSessionId])

  async function refreshSessions() {
    if (!user) return

    const sessionsData = await getBacktestingSessions(user.id)
    setSessions(sessionsData)

    if (!selectedSessionId && sessionsData[0]) {
      setSelectedSessionId(sessionsData[0].id)
    }

    if (selectedSessionId && !sessionsData.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(sessionsData[0]?.id ?? null)
    }
  }

  async function refreshTrades() {
    if (!user || !selectedSessionId) return
    const tradesData = await getBacktestingTrades(user.id, selectedSessionId)
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
    if (!user) return

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
          user_id: user.id,
          name: newSystemName,
          entry_rules: null,
          sl_rules: null,
          tp_rules: null,
          description: null,
        })
        systemId = createdSystem.id
      }

      const payload: BacktestingSessionInsert = {
        user_id: user.id,
        system_id: systemId,
        name: sessionName,
        notes: sessionForm.notes.trim() || null,
      }

      const created = await createBacktestingSession(payload)

      if (newSystemName) {
        const systemsData = await getSystems(user.id)
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
    setTradeForm(initialTradeFormState)
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
    setIsTradeModalOpen(true)
  }

  function closeTradeModal() {
    if (savingTrade) return
    setIsTradeModalOpen(false)
    setEditingTrade(null)
    setTradeForm(initialTradeFormState)
  }

  function openImportModal() {
    if (!selectedSessionId) return
    setIsImportModalOpen(true)
  }

  function closeImportModal() {
    setIsImportModalOpen(false)
  }

  async function handleSaveTrade(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedSessionId) return

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
        user_id: user.id,
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

      if (editingTrade) {
        await updateBacktestingTrade(editingTrade.id, payload)
      } else {
        await createBacktestingTrade(payload)
      }

      await refreshTrades()
      closeTradeModal()
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

  if (loading) return <div className="p-8">Loading backtesting...</div>

  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
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
        <aside className="lg:col-span-4 border rounded-lg p-4 h-fit">
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

        <section className="lg:col-span-8">
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
                  </div>
                  <div className="flex gap-2">
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

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <MiniStat label="Total Trades" value={sessionStats.totalTrades} />
                  <MiniStat label="Total R" value={sessionStats.totalR.toFixed(2)} />
                  <MiniStat label="Win Rate" value={`${sessionStats.winRate.toFixed(1)}%`} />
                  <MiniStat label="EV / Trade (R)" value={`${sessionStats.expectedValueR.toFixed(2)}R`} />
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
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
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
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-t">
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
                                <div className="absolute right-0 mt-1 w-28 bg-white border rounded-md shadow-lg z-10">
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
                    {trades.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
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
              <input
                type="number"
                step="0.000001"
                value={tradeForm.target_price}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, target_price: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
              />
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

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingTrade}
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

      {user && selectedSessionId && (
        <Modal isOpen={isImportModalOpen} onClose={closeImportModal}>
          <ImportBacktestingTradesForm
            userId={user.id}
            sessionId={selectedSessionId}
            onClose={closeImportModal}
            onSuccess={refreshTrades}
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

function formatDateAndTime(date: string, time: string | null): string {
  if (!time) return date
  return `${date} ${time.substring(0, 5)}`
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
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
