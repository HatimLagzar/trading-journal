'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import AuthNavbar from '@/app/components/AuthNavbar'
import { getTrades, deleteTrade } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import type { Trade } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'
import Modal from './Modal'
import CloseTradeForm from './CloseTradeForm'
import ImportTradesForm from './ImportTradesForm'
import TradeForm from './TradeForm'
import TradeChartView from './TradeChartView'
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
  previousYear: number
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
  bestDay: PerformanceEntry | null
  worstDay: PerformanceEntry | null
  bestHour: PerformanceEntry | null
  worstHour: PerformanceEntry | null
}

export default function TradesPage() {
  const router = useRouter()
  const { isPremium, loading: premiumLoading, redirectToPremium } = usePremiumAccess()

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
  const [chartTrade, setChartTrade] = useState<Trade | null>(null)
  const [chartSystemLabel, setChartSystemLabel] = useState('-')
  const [isChartModalOpen, setIsChartModalOpen] = useState(false)
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

  const ongoingTrades = useMemo(() => {
    return filteredTrades.filter((trade) => trade.avg_exit === null)
  }, [filteredTrades])

  const completedTrades = useMemo(() => {
    return filteredTrades.filter((trade) => trade.avg_exit !== null)
  }, [filteredTrades])

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
    const previousYear = now.getFullYear() - 1
    const previousYearStart = `${previousYear}-01-01`
    const previousYearEnd = `${previousYear}-12-31`
    const today = toLocalDateString(now)

    const sumRInRange = (start: string, end: string): number => {
      return statsTrades.reduce((sum, trade) => {
        const tradeDate = normalizeTradeDate(trade.trade_date)
        if (!tradeDate) return sum
        if (tradeDate < start || tradeDate > end) return sum
        return sum + (trade.r_multiple ?? 0)
      }, 0)
    }

    return {
      today: sumRInRange(today, today),
      week: sumRInRange(weekStart, today),
      month: sumRInRange(monthStart, today),
      last90Days: sumRInRange(last90DaysStart, today),
      year: sumRInRange(yearStart, today),
      previousYear: sumRInRange(previousYearStart, previousYearEnd),
    }
  }, [statsTrades])

  useEffect(() => {
    const sortedTrades = [...statsTrades]
      .sort((a, b) => {
        const aDate = normalizeTradeDate(a.trade_date) ?? '9999-12-31'
        const bDate = normalizeTradeDate(b.trade_date) ?? '9999-12-31'
        if (aDate !== bDate) {
          return aDate.localeCompare(bDate)
        }

        const aTime = (a.trade_time ?? '').slice(0, 8)
        const bTime = (b.trade_time ?? '').slice(0, 8)
        return aTime.localeCompare(bTime)
      })

    const oldestTrade = sortedTrades[0] ?? null
    const oldestTradeDate = oldestTrade ? normalizeTradeDate(oldestTrade.trade_date) : null
    const trades2025 = sortedTrades.filter((trade) => {
      const normalizedDate = normalizeTradeDate(trade.trade_date)
      return normalizedDate !== null && normalizedDate.startsWith('2025-')
    })

    console.log('[TradesPage] All trades oldest first:', sortedTrades)
    console.log('[TradesPage] Oldest trade date:', oldestTradeDate)
    console.log('[TradesPage] Trades in 2025 (oldest first):', trades2025)
  }, [statsTrades])

  const performanceStats = useMemo<PerformanceStats>(() => {
    const systemTotals = new Map<string, number>()
    const assetTotals = new Map<string, number>()
    const weekdayTotals = new Map<string, number>()
    const hourTotals = new Map<string, number>()

    statsTrades.forEach((trade) => {
      const tradePnL = (trade.realised_win ?? 0) - (trade.realised_loss ?? 0)

      const systemKey = trade.system_id ?? '__unassigned__'
      systemTotals.set(systemKey, (systemTotals.get(systemKey) ?? 0) + tradePnL)

      const assetKey = trade.coin?.trim() || 'Unknown'
      assetTotals.set(assetKey, (assetTotals.get(assetKey) ?? 0) + tradePnL)

      const weekdayKey = getWeekdayLabelFromTradeDate(trade.trade_date)
      if (weekdayKey) {
        weekdayTotals.set(weekdayKey, (weekdayTotals.get(weekdayKey) ?? 0) + tradePnL)
      }

      const hourKey = getHourLabelFromTradeTime(trade.trade_time)
      if (hourKey) {
        hourTotals.set(hourKey, (hourTotals.get(hourKey) ?? 0) + tradePnL)
      }
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
      bestDay: pickBest(weekdayTotals),
      worstDay: pickWorst(weekdayTotals),
      bestHour: pickBest(hourTotals),
      worstHour: pickWorst(hourTotals),
    }
  }, [statsTrades, systems])

  if (loading) return <div className="p-8">Loading trades...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>

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
    if (!premiumLoading && !isPremium) {
      redirectToPremium('import-trades')
      return
    }

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

  function handleCloseChartModal() {
    setIsChartModalOpen(false)
    setChartTrade(null)
    setChartSystemLabel('-')
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

  function handleViewChart(trade: Trade) {
    if (!premiumLoading && !isPremium) {
      redirectToPremium('chart-view')
      return
    }

    setChartTrade(trade)
    setChartSystemLabel(getSystemName(trade.system_id))
    setIsChartModalOpen(true)
  }

  function handleOpenFocus(trade: Trade) {
    setOpenDeleteMenuTradeId(null)
    router.push(`/trades/${trade.id}`)
  }

  function renderTradeRow(trade: Trade, selectable: boolean) {
    return (
      <tr key={trade.id} className="border-t hover:bg-gray-50">
        {selectable && (
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={selectedTradeIds.includes(trade.id)}
              onChange={() => toggleTradeSelection(trade.id)}
            />
          </td>
        )}
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
        <td
          className={`px-4 py-3 text-right ${
            (trade.realised_win ?? 0) > 0
              ? 'text-green-600'
              : (trade.realised_loss ?? 0) > 0
                ? 'text-red-600'
                : ''
          }`}
        >
          {trade.realised_win ? `+$${trade.realised_win}` : trade.realised_loss ? `-$${trade.realised_loss}` : '-'}
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
              onClick={() => handleOpenFocus(trade)}
              className="px-2 py-1 text-xs text-sky-700 hover:text-sky-900 hover:underline"
            >
              Focus
            </button>
            <button
              onClick={() => {
                setOpenDeleteMenuTradeId(null)
                handleViewChart(trade)
              }}
              className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {!premiumLoading && !isPremium ? 'Chart (Premium)' : 'Chart'}
            </button>
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
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f7f9] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AuthNavbar current="trades" onError={(message) => setError(message || null)} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Live trades</h1>
          <div className="flex gap-3">
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
            {!premiumLoading && !isPremium ? 'Import (Premium)' : 'Import'}
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

      {/* Ongoing Trades Table */}
      <div className="mb-6 border border-amber-200 rounded-lg overflow-hidden bg-amber-50/40">
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-100/40 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-amber-900">Ongoing trades ({ongoingTrades.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-amber-50">
            <tr>
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
            {ongoingTrades.map((trade) => renderTradeRow(trade, false))}
            {ongoingTrades.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No ongoing trades in this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Completed Trades Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Closed trades ({completedTrades.length})</h2>
          {completedTrades.length > 0 && (
            <button
              onClick={() => toggleSelectAllTrades(completedTrades.map((trade) => trade.id))}
              className="text-xs text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
            >
              {areAllTradesSelected(completedTrades.map((trade) => trade.id)) ? 'Unselect all' : 'Select all'}
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left" />
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
            {completedTrades.map((trade) => renderTradeRow(trade, true))}
            {completedTrades.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  No closed trades in this filter.
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

      {chartTrade && (
        <Modal
          isOpen={isChartModalOpen}
          onClose={handleCloseChartModal}
          closeOnOverlayClick={false}
          contentClassName="max-w-[75vw]"
        >
          <TradeChartView
            trade={chartTrade}
            systemLabel={chartSystemLabel}
            onClose={handleCloseChartModal}
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
    </div>
  )
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
    { label: 'Previous Year', value: stats.previousYear },
  ]

  return (
    <div className="bg-white border rounded-lg p-4 col-span-full">
      <div className="text-sm text-gray-500 mb-2">Total R by Period</div>
      <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-gray-200">
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
    { label: 'Day', data: stats.bestDay },
    { label: 'Time', data: stats.bestHour },
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
    { label: 'Day', data: stats.worstDay },
    { label: 'Time', data: stats.worstHour },
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
