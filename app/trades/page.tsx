'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getTrades, deleteTrade } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import type { Trade } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'
import Modal from './Modal'
import CloseTradeForm from './CloseTradeForm'
import ImportTradesForm from './ImportTradesForm'
import TradeForm from './TradeForm'
import type { User } from '@supabase/supabase-js'

type DashboardStats = {
  totalTrades: number
  winRate: number
  netPnL: number
  totalR: number
  expectedValue: number
  profitFactor: number | null
}

type PeriodRStats = {
  today: number
  week: number
  month: number
  last90Days: number
  year: number
}

type PerformanceEntry = {
  label: string
  netPnL: number
}

type PerformanceStats = {
  bestSystem: PerformanceEntry | null
  worstSystem: PerformanceEntry | null
  bestAsset: PerformanceEntry | null
  worstAsset: PerformanceEntry | null
}

export default function TradesPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [systems, setSystems] = useState<System[]>([])
  const [subSystems, setSubSystems] = useState<SubSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedSystemId, setSelectedSystemId] = useState<string>('')
  const [selectedSubSystemId, setSelectedSubSystemId] = useState<string>('')
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([])
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null)
  const [openDeleteMenuTradeId, setOpenDeleteMenuTradeId] = useState<string | null>(null)

  // Function to refresh trades and filter data
  async function refreshData() {
    if (!user) return

    try {
      const [tradesData, systemsData, subSystemsData] = await Promise.all([
        getTrades(user.id),
        getSystems(user.id),
        getSubSystems(user.id),
      ])
      setTrades(tradesData)
      setSystems(systemsData)
      setSubSystems(subSystemsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades')
    }
  }

  useEffect(() => {
    async function loadData() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      try {
        const [tradesData, systemsData, subSystemsData] = await Promise.all([
          getTrades(user.id),
          getSystems(user.id),
          getSubSystems(user.id),
        ])
        setTrades(tradesData)
        setSystems(systemsData)
        setSubSystems(subSystemsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trades')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  useEffect(() => {
    setSelectedTradeIds((prev) => prev.filter((id) => trades.some((trade) => trade.id === id)))
  }, [trades])

  const availableSubSystems = useMemo(() => {
    if (!selectedSystemId) return []
    return subSystems.filter((subSystem) => subSystem.system_id === selectedSystemId)
  }, [selectedSystemId, subSystems])

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (selectedSystemId && trade.system_id !== selectedSystemId) return false
      if (selectedSubSystemId && trade.sub_system_id !== selectedSubSystemId) return false
      return true
    })
  }, [selectedSubSystemId, selectedSystemId, trades])

  useEffect(() => {
    if (!selectedSubSystemId) return

    const subSystemStillVisible = availableSubSystems.some((subSystem) => subSystem.id === selectedSubSystemId)
    if (!subSystemStillVisible) {
      setSelectedSubSystemId('')
    }
  }, [availableSubSystems, selectedSubSystemId])

  useEffect(() => {
    setSelectedTradeIds((prev) => prev.filter((id) => filteredTrades.some((trade) => trade.id === id)))
  }, [filteredTrades])

  const selectedTradesInView = useMemo(() => {
    return filteredTrades.filter((trade) => selectedTradeIds.includes(trade.id))
  }, [filteredTrades, selectedTradeIds])

  const statsTrades = selectedTradesInView.length > 0 ? selectedTradesInView : filteredTrades

  const stats = useMemo<DashboardStats>(() => {
    const totalTrades = statsTrades.length

    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        netPnL: 0,
        totalR: 0,
        expectedValue: 0,
        profitFactor: null,
      }
    }

    const winners = statsTrades.filter((trade) => (trade.realised_win ?? 0) > 0).length
    const totalProfit = statsTrades.reduce((sum, trade) => sum + (trade.realised_win ?? 0), 0)
    const totalLoss = statsTrades.reduce((sum, trade) => sum + (trade.realised_loss ?? 0), 0)

    const totalR = statsTrades.reduce((sum, trade) => sum + (trade.r_multiple ?? 0), 0)

    const expectedValue = totalR / totalTrades
    const profitFactor = totalLoss > 0
      ? totalProfit / totalLoss
      : totalProfit > 0
        ? Number.POSITIVE_INFINITY
        : null

    return {
      totalTrades,
      winRate: (winners / totalTrades) * 100,
      netPnL: totalProfit - totalLoss,
      totalR,
      expectedValue,
      profitFactor,
    }
  }, [statsTrades])

  const periodRStats = useMemo<PeriodRStats>(() => {
    const now = new Date()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    function toLocalDateString(date: Date): string {
      const year = date.getFullYear()
      const month = `${date.getMonth() + 1}`.padStart(2, '0')
      const day = `${date.getDate()}`.padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    function parseTradeDate(tradeDate: string): Date | null {
      if (!tradeDate) return null

      // Prefer date-only parsing to avoid timezone drift.
      const dateOnly = new Date(`${tradeDate}T00:00:00`)
      if (!Number.isNaN(dateOnly.getTime())) return dateOnly

      const fallback = new Date(tradeDate)
      if (Number.isNaN(fallback.getTime())) return null
      return fallback
    }

    const startOfWeek = new Date(now)
    const dayOfWeek = startOfWeek.getDay()
    const daysFromMonday = (dayOfWeek + 6) % 7
    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday)
    const weekStart = toLocalDateString(startOfWeek)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStart = toLocalDateString(startOfMonth)

    const startOfLast90Days = new Date(now)
    startOfLast90Days.setDate(startOfLast90Days.getDate() - 89)
    const last90DaysStart = toLocalDateString(startOfLast90Days)

    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const yearStart = toLocalDateString(startOfYear)

    const sumRInRange = (start: Date, end: Date): number => {
      return statsTrades.reduce((sum, trade) => {
        const tradeDate = parseTradeDate(trade.trade_date)
        if (!tradeDate) return sum
        if (tradeDate < start || tradeDate > end) return sum
        return sum + (trade.r_multiple ?? 0)
      }, 0)
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStartDate = new Date(`${weekStart}T00:00:00`)
    const monthStartDate = new Date(`${monthStart}T00:00:00`)
    const last90DaysStartDate = new Date(`${last90DaysStart}T00:00:00`)
    const yearStartDate = new Date(`${yearStart}T00:00:00`)
    return {
      today: sumRInRange(todayStart, endOfToday),
      week: sumRInRange(weekStartDate, endOfToday),
      month: sumRInRange(monthStartDate, endOfToday),
      last90Days: sumRInRange(last90DaysStartDate, endOfToday),
      year: sumRInRange(yearStartDate, endOfToday),
    }
  }, [statsTrades])

  const performanceStats = useMemo<PerformanceStats>(() => {
    const systemTotals = new Map<string, number>()
    const assetTotals = new Map<string, number>()

    statsTrades.forEach((trade) => {
      const tradePnL = (trade.realised_win ?? 0) - (trade.realised_loss ?? 0)

      const systemKey = trade.system_id ?? '__unassigned__'
      systemTotals.set(systemKey, (systemTotals.get(systemKey) ?? 0) + tradePnL)

      const assetKey = trade.coin?.trim() || 'Unknown'
      assetTotals.set(assetKey, (assetTotals.get(assetKey) ?? 0) + tradePnL)
    })

    function resolveSystemLabel(systemId: string): string {
      if (systemId === '__unassigned__') return 'Unassigned'
      const system = systems.find((item) => item.id === systemId)
      return system?.name || '-'
    }

    function pickBest(map: Map<string, number>, labelResolver?: (key: string) => string): PerformanceEntry | null {
      const entries = Array.from(map.entries())
      if (entries.length === 0) return null

      const [key, value] = entries.reduce((best, current) => (current[1] > best[1] ? current : best))
      return {
        label: labelResolver ? labelResolver(key) : key,
        netPnL: value,
      }
    }

    function pickWorst(map: Map<string, number>, labelResolver?: (key: string) => string): PerformanceEntry | null {
      const entries = Array.from(map.entries())
      if (entries.length === 0) return null

      const [key, value] = entries.reduce((worst, current) => (current[1] < worst[1] ? current : worst))
      return {
        label: labelResolver ? labelResolver(key) : key,
        netPnL: value,
      }
    }

    return {
      bestSystem: pickBest(systemTotals, resolveSystemLabel),
      worstSystem: pickWorst(systemTotals, resolveSystemLabel),
      bestAsset: pickBest(assetTotals),
      worstAsset: pickWorst(assetTotals),
    }
  }, [statsTrades, systems])

  if (loading) return <div className="p-8">Loading trades...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Open modal for creating a new trade
  function handleAddTrade() {
    setSelectedTrade(null)
    setIsModalOpen(true)
  }

  // Open modal for editing a trade
  function handleEditTrade(trade: Trade) {
    setSelectedTrade(trade)
    setIsModalOpen(true)
  }

  // Close modal
  function handleCloseModal() {
    setIsModalOpen(false)
    setSelectedTrade(null)
  }

  function handleOpenImportModal() {
    setIsImportModalOpen(true)
  }

  function handleCloseImportModal() {
    setIsImportModalOpen(false)
  }

  function handleOpenCloseModal(trade: Trade) {
    setClosingTrade(trade)
    setIsCloseModalOpen(true)
  }

  function handleCloseTradeModal() {
    setIsCloseModalOpen(false)
    setClosingTrade(null)
  }

  // Handle successful form submission
  function handleFormSuccess() {
    refreshData()
  }

  // Handle delete trade
  async function handleDeleteTrade(trade: Trade) {
    if (!confirm(`Are you sure you want to delete trade #${trade.trade_number}?`)) {
      return
    }

    try {
      await deleteTrade(trade.id)
      // Refresh the list
      await refreshData()
      setOpenDeleteMenuTradeId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete trade')
    }
  }

  // Format date and time as "Monday 10:00"
  function formatTradeDateTime(trade: Trade): string {
    const date = new Date(trade.trade_date)
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    
    if (trade.trade_time) {
      const time = trade.trade_time.substring(0, 5)
      return `${dayName} ${time}`
    }
    
    return dayName
  }

  function getSystemName(systemId: string | null): string {
    if (!systemId) return '-'
    const system = systems.find(s => s.id === systemId)
    return system?.name || '-'
  }

  function getSystemInitials(systemId: string | null): string {
    const fullName = getSystemName(systemId)
    if (fullName === '-') return '-'

    const initials = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('')

    return initials || '-'
  }

  function toggleTradeSelection(tradeId: string) {
    setSelectedTradeIds((prev) => {
      if (prev.includes(tradeId)) {
        return prev.filter((id) => id !== tradeId)
      }

      return [...prev, tradeId]
    })
  }

  function toggleSelectAllManualTrades() {
    if (selectedTradeIds.length === filteredTrades.length) {
      setSelectedTradeIds([])
      return
    }

    setSelectedTradeIds(filteredTrades.map((trade) => trade.id))
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Live trades</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/systems')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Systems
          </button>
          <button
            onClick={() => router.push('/backtesting')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Backtesting
          </button>
          <button
            onClick={handleAddTrade}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Trade
          </button>
          <button
            onClick={handleOpenImportModal}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
          >
            Import
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">System</label>
            <select
              value={selectedSystemId}
              onChange={(e) => {
                setSelectedSystemId(e.target.value)
                setSelectedSubSystemId('')
              }}
              className="w-full px-3 py-2 border rounded-lg bg-white"
            >
              <option value="">All Systems</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>{system.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sub-System</label>
            <select
              value={selectedSubSystemId}
              onChange={(e) => setSelectedSubSystemId(e.target.value)}
              disabled={!selectedSystemId}
              className="w-full px-3 py-2 border rounded-lg bg-white disabled:bg-gray-100"
            >
              <option value="">All Sub-Systems</option>
              {availableSubSystems.map((subSystem) => (
                <option key={subSystem.id} value={subSystem.id}>{subSystem.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Trades" value={stats.totalTrades} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard
          label="Net P&L"
          value={`$${stats.netPnL.toFixed(2)}`}
          className={stats.netPnL >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard label="Total R" value={stats.totalR.toFixed(2)} />
        <StatCard
          label="EV / Trade (R)"
          value={`${stats.expectedValue.toFixed(2)}R`}
          className={stats.expectedValue >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard
          label="Profit Factor"
          value={
            stats.profitFactor === null
              ? '-'
              : Number.isFinite(stats.profitFactor)
                ? stats.profitFactor.toFixed(2)
                : '∞'
          }
        />
        <PeriodRCard stats={periodRStats} />
        <BestPerformersCard stats={performanceStats} />
        <WorstPerformersCard stats={performanceStats} />
      </div>

      {/* Trades Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={filteredTrades.length > 0 && selectedTradeIds.length === filteredTrades.length}
                  onChange={toggleSelectAllManualTrades}
                  disabled={filteredTrades.length === 0}
                />
              </th>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">System</th>
              <th className="px-4 py-3 text-left">Coin</th>
              <th className="px-4 py-3 text-left">Direction</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Exit</th>
              <th className="px-4 py-3 text-right">R-Multiple</th>
              <th className="px-4 py-3 text-right">P&L</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.map((trade) => (
              <tr key={trade.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedTradeIds.includes(trade.id)}
                    onChange={() => toggleTradeSelection(trade.id)}
                  />
                </td>
                <td className="px-4 py-3">{trade.trade_number}</td>
                <td className="px-4 py-3">{formatTradeDateTime(trade)}</td>
                <td className="px-4 py-3 text-gray-600">{getSystemInitials(trade.system_id)}</td>
                <td className="px-4 py-3 font-medium">{trade.coin}</td>
                <td className="px-4 py-3">
                  <span className={trade.direction === 'long' ? 'text-green-600' : 'text-red-600'}>
                    {trade.direction.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{trade.avg_entry}</td>
                <td className="px-4 py-3 text-right">{trade.avg_exit ?? '-'}</td>
                <td className="px-4 py-3 text-right">{trade.r_multiple?.toFixed(2) ?? '-'}</td>
                <td className={`px-4 py-3 text-right ${
                  (trade.realised_win ?? 0) > 0 ? 'text-green-600' :
                  (trade.realised_loss ?? 0) > 0 ? 'text-red-600' : ''
                }`}>
                  {trade.realised_win ? `+$${trade.realised_win}` :
                   trade.realised_loss ? `-$${trade.realised_loss}` : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    {trade.avg_exit === null && (
                      <button
                        onClick={() => {
                          setOpenDeleteMenuTradeId(null)
                          handleOpenCloseModal(trade)
                        }}
                        className="px-2 py-1 text-xs text-amber-600 hover:text-amber-800 hover:underline"
                      >
                        Close
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setOpenDeleteMenuTradeId(null)
                        handleEditTrade(trade)
                      }}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Edit
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => {
                          setOpenDeleteMenuTradeId((prev) => (prev === trade.id ? null : trade.id))
                        }}
                        className="px-2 py-1 text-xs text-gray-800 hover:text-black cursor-pointer"
                        aria-expanded={openDeleteMenuTradeId === trade.id}
                        aria-haspopup="menu"
                      >
                        ⋯
                      </button>
                      {openDeleteMenuTradeId === trade.id && (
                        <div className="absolute right-0 mt-1 w-28 bg-white border rounded-md shadow-lg z-10">
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
            {filteredTrades.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  No trades match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Add/Edit Trade */}
      {user && (
        <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
          <TradeForm
            trade={selectedTrade}
            onClose={handleCloseModal}
            onSuccess={handleFormSuccess}
            userId={user.id}
          />
        </Modal>
      )}

      {user && closingTrade && (
        <Modal isOpen={isCloseModalOpen} onClose={handleCloseTradeModal}>
          <CloseTradeForm
            trade={closingTrade}
            userId={user.id}
            onClose={handleCloseTradeModal}
            onSuccess={handleFormSuccess}
          />
        </Modal>
      )}

      {user && (
        <Modal isOpen={isImportModalOpen} onClose={handleCloseImportModal}>
          <ImportTradesForm
            userId={user.id}
            onClose={handleCloseImportModal}
            onSuccess={handleFormSuccess}
          />
        </Modal>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  className = ''
}: {
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold ${className}`}>{value}</div>
    </div>
  )
}

function PeriodRCard({ stats }: { stats: PeriodRStats }) {
  const rows = [
    { label: 'Today', value: stats.today },
    { label: 'This Week', value: stats.week },
    { label: 'This Month', value: stats.month },
    { label: 'Last 90 Days', value: stats.last90Days },
    { label: 'This Year', value: stats.year },
  ]

  return (
    <div className="bg-white border rounded-lg p-4 col-span-full">
      <div className="text-sm text-gray-500 mb-2">Total R by Period</div>
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-200">
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-2 text-center">
            <div className="text-xs text-gray-500">{row.label}</div>
            <div className={`mt-1 text-lg font-semibold ${row.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {`${row.value >= 0 ? '+' : ''}${row.value.toFixed(2)}R`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BestPerformersCard({ stats }: { stats: PerformanceStats }) {
  const rows = [
    { label: 'System', data: stats.bestSystem },
    { label: 'Asset', data: stats.bestAsset },
  ]

  return (
    <div className="bg-white border rounded-lg p-4 col-span-full lg:col-span-3">
      <div className="text-sm text-gray-500 mb-2">Best Performers</div>
      <div className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center gap-3">
            <span className="text-gray-600 truncate">{row.label}</span>
            {row.data ? (
              <span className="text-green-600 font-medium text-right">
                {`${row.data.label} (${row.data.netPnL >= 0 ? '+' : ''}$${row.data.netPnL.toFixed(2)})`}
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

function WorstPerformersCard({ stats }: { stats: PerformanceStats }) {
  const rows = [
    { label: 'System', data: stats.worstSystem },
    { label: 'Asset', data: stats.worstAsset },
  ]

  return (
    <div className="bg-white border rounded-lg p-4 col-span-full lg:col-span-3">
      <div className="text-sm text-gray-500 mb-2">Worst Performers</div>
      <div className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center gap-3">
            <span className="text-gray-600 truncate">{row.label}</span>
            {row.data ? (
              <span className="text-red-600 font-medium text-right">
                {`${row.data.label} (${row.data.netPnL >= 0 ? '+' : ''}$${row.data.netPnL.toFixed(2)})`}
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
