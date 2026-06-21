'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import AuthNavbar from '@/app/components/AuthNavbar'
import { useTheme } from '@/lib/ThemeContext'
import { useUserPreferences } from '@/lib/UserPreferencesContext'
import {
  classifyOutcomeR,
  getOutcomeColorClass,
  isBreakEvenOutcome,
  isLossOutcome,
  isWinOutcome,
} from '@/lib/trade-outcome'
import { getTrades, deleteTrade, deleteTradesBulk, updateTrade, updateTradesBulk } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import type { Trade, TradeUpdate } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'
import {
  aggregateTimingBuckets,
  buildTimingTotals,
  pickBestTimingEntry,
  pickSecondBestTimingEntry,
  pickSecondWorstTimingEntry,
  pickWorstTimingEntry,
} from '@/lib/performance-timing'
import TimingBreakdownModal from '@/app/components/TimingBreakdownModal'
import Modal from './Modal'
import CloseTradeForm from './CloseTradeForm'
import ImportTradesForm from './ImportTradesForm'
import TradeForm from './TradeForm'
import TradeDecisionsModal from './TradeDecisionsModal'
import TradeChartView from './TradeChartView'
import DateRangePicker from './DateRangePicker'
import type { DateRangePreset } from './DateRangePicker'

interface TradesClientProps {
  initialUserId: string
  initialTrades: Trade[]
  initialSystems: System[]
  initialSubSystems: SubSystem[]
  initialError: string | null
}

type DashboardStats = {
  totalTrades: number
  winRate: number
  netPnL: number
  totalR: number
  expectedValue: number
  mev: number
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
  secondBestHour: PerformanceEntry | null
  worstHour: PerformanceEntry | null
  secondWorstHour: PerformanceEntry | null
}

type DateSortDirection = 'none' | 'asc' | 'desc'

type ActiveDateRange = {
  start: string | null
  end: string | null
  label: string
  isActive: boolean
}

type FloatingChartWidgetState = {
  widgetId: string
  trade: Trade
  systemLabel: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

type BulkEditSystemMode = 'unchanged' | 'no_system' | 'set_system'
type BulkEditRiskMode = 'unchanged' | 'set' | 'clear'

const FLOATING_WIDGET_DEFAULT_WIDTH = 560
const FLOATING_WIDGET_DEFAULT_HEIGHT = 500
const FLOATING_WIDGET_MIN_WIDTH = 420
const FLOATING_WIDGET_MIN_HEIGHT = 360
const FLOATING_WIDGET_MARGIN = 12
const UNASSIGNED_SYSTEM_FILTER = '__no_system__'

export default function TradesClient({
  initialUserId,
  initialTrades,
  initialSystems,
  initialSubSystems,
  initialError,
}: TradesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isPremium, loading: premiumLoading, redirectToPremium } = usePremiumAccess()
  const { isDark } = useTheme()
  const { breakEvenRThreshold } = useUserPreferences()

  const [userId] = useState(initialUserId)
  const [trades, setTrades] = useState<Trade[]>(initialTrades)
  const [systems, setSystems] = useState<System[]>(initialSystems)
  const [subSystems, setSubSystems] = useState<SubSystem[]>(initialSubSystems)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([])
  const [selectedSubSystemId, setSelectedSubSystemId] = useState<string>('')
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState<'all' | 'won' | 'lost' | 'be'>('all')
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<'all' | 'long' | 'short'>('all')
  const [selectedDateRangePreset, setSelectedDateRangePreset] = useState<DateRangePreset>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showNotesColumn, setShowNotesColumn] = useState(false)
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([])
  const [dateSortDirection, setDateSortDirection] = useState<DateSortDirection>('none')
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null)
  const [floatingChartWidgets, setFloatingChartWidgets] = useState<FloatingChartWidgetState[]>([])
  const [topChartWidgetZIndex, setTopChartWidgetZIndex] = useState(1)
  const [openDeleteMenuTradeId, setOpenDeleteMenuTradeId] = useState<string | null>(null)
  const [decisionsTrade, setDecisionsTrade] = useState<Trade | null>(null)
  const [isTimingBreakdownOpen, setIsTimingBreakdownOpen] = useState(false)
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false)
  const [bulkEditTradeIds, setBulkEditTradeIds] = useState<string[]>([])
  const [bulkEditSystemMode, setBulkEditSystemMode] = useState<BulkEditSystemMode>('unchanged')
  const [bulkEditSystemId, setBulkEditSystemId] = useState('')
  const [bulkEditRiskMode, setBulkEditRiskMode] = useState<BulkEditRiskMode>('unchanged')
  const [bulkEditRiskValue, setBulkEditRiskValue] = useState('')
  const [bulkEditSaving, setBulkEditSaving] = useState(false)
  const [bulkEditError, setBulkEditError] = useState<string | null>(null)
  const [isSystemFilterMenuOpen, setIsSystemFilterMenuOpen] = useState(false)
  const systemFilterMenuRef = useRef<HTMLDivElement | null>(null)

  // Function to refresh trades and filter data
  async function refreshData() {
    if (!userId) return

    try {
      const [tradesData, systemsData, subSystemsData] = await Promise.all([
        getTrades(userId),
        getSystems(userId),
        getSubSystems(userId),
      ])
      setTrades(tradesData)
      setSystems(systemsData)
      setSubSystems(subSystemsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades')
    }
  }

  const selectedRealSystemIds = useMemo(
    () => selectedSystemIds.filter((id) => id !== UNASSIGNED_SYSTEM_FILTER),
    [selectedSystemIds],
  )

  const singleSelectedSystemId = useMemo(() => {
    if (selectedRealSystemIds.length !== 1) return ''
    return selectedRealSystemIds[0] ?? ''
  }, [selectedRealSystemIds])

  const availableSubSystems = useMemo(() => {
    if (!singleSelectedSystemId) return []
    return subSystems.filter((subSystem) => subSystem.system_id === singleSelectedSystemId)
  }, [singleSelectedSystemId, subSystems])

  const effectiveSelectedSubSystemId = useMemo(() => {
    if (!selectedSubSystemId) return ''

    return availableSubSystems.some((subSystem) => subSystem.id === selectedSubSystemId)
      ? selectedSubSystemId
      : ''
  }, [availableSubSystems, selectedSubSystemId])

  useEffect(() => {
    if (!isSystemFilterMenuOpen) return

    function handleDocumentMouseDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!systemFilterMenuRef.current?.contains(target)) {
        setIsSystemFilterMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown)
    }
  }, [isSystemFilterMenuOpen])

  useEffect(() => {
    if (selectedRealSystemIds.length === 1) return
    setSelectedSubSystemId('')
  }, [selectedRealSystemIds.length])

  useEffect(() => {
    const decisionsTradeId = searchParams.get('decisions')
    if (!decisionsTradeId) return

    const trade = trades.find((item) => item.id === decisionsTradeId)
    if (trade) {
      setDecisionsTrade(trade)
    }

    router.replace('/trades', { scroll: false })
  }, [router, searchParams, trades])

  const dateRangeError = useMemo(() => {
    if (selectedDateRangePreset !== 'custom') return null
    if (!customStartDate || !customEndDate) return null
    return customStartDate <= customEndDate ? null : 'From date must be on or before To date.'
  }, [customEndDate, customStartDate, selectedDateRangePreset])

  const activeDateRange = useMemo<ActiveDateRange>(() => {
    if (selectedDateRangePreset === 'all') {
      return {
        start: null,
        end: null,
        label: 'All time',
        isActive: false,
      }
    }

    if (selectedDateRangePreset === 'custom') {
      if (dateRangeError) {
        return {
          start: null,
          end: null,
          label: 'Invalid custom range',
          isActive: false,
        }
      }

      const start = customStartDate || null
      const end = customEndDate || null
      return {
        start,
        end,
        label: formatDateRangeLabel(start, end),
        isActive: Boolean(start || end),
      }
    }

    const presetRange = getUtcPresetRange(selectedDateRangePreset)
    return {
      ...presetRange,
      isActive: true,
    }
  }, [customEndDate, customStartDate, dateRangeError, selectedDateRangePreset])

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const normalizedTradeDate = normalizeTradeDate(trade.trade_date)

      const matchesSystem = selectedSystemIds.length === 0
        ? true
        : selectedSystemIds.some((systemId) =>
          systemId === UNASSIGNED_SYSTEM_FILTER ? trade.system_id === null : trade.system_id === systemId,
        )

      const matchesSubSystem = !effectiveSelectedSubSystemId || trade.sub_system_id === effectiveSelectedSubSystemId

      const matchesOutcome = selectedOutcomeFilter === 'all'
        || (selectedOutcomeFilter === 'won' && isWinOutcome(trade.r_multiple, breakEvenRThreshold, trade.avg_exit !== null))
        || (selectedOutcomeFilter === 'lost' && isLossOutcome(trade.r_multiple, breakEvenRThreshold, trade.avg_exit !== null))
        || (selectedOutcomeFilter === 'be' && isBreakEvenOutcome(trade.r_multiple, breakEvenRThreshold, trade.avg_exit !== null))

      const matchesDirection = selectedDirectionFilter === 'all'
        || (selectedDirectionFilter === 'long' && trade.direction === 'long')
        || (selectedDirectionFilter === 'short' && trade.direction === 'short')

      const matchesDateRange = isDateWithinRange(normalizedTradeDate, activeDateRange.start, activeDateRange.end)

      return matchesSystem && matchesSubSystem && matchesOutcome && matchesDirection && matchesDateRange
    })
  }, [activeDateRange.end, activeDateRange.start, breakEvenRThreshold, effectiveSelectedSubSystemId, selectedDirectionFilter, selectedOutcomeFilter, selectedSystemIds, trades])

  const dateSortedTrades = useMemo(() => {
    if (dateSortDirection === 'none') return filteredTrades

    return [...filteredTrades].sort((a, b) => {
      const aKey = getTradeDateTimeSortKey(a)
      const bKey = getTradeDateTimeSortKey(b)
      const compare = aKey.localeCompare(bKey)
      return dateSortDirection === 'asc' ? compare : -compare
    })
  }, [dateSortDirection, filteredTrades])

  const ongoingTrades = useMemo(() => {
    return dateSortedTrades.filter((trade) => trade.avg_exit === null)
  }, [dateSortedTrades])

  const completedTrades = useMemo(() => {
    return dateSortedTrades.filter((trade) => trade.avg_exit !== null)
  }, [dateSortedTrades])

  const visibleSelectedTradeIds = useMemo(() => {
    return selectedTradeIds.filter((id) => filteredTrades.some((trade) => trade.id === id))
  }, [filteredTrades, selectedTradeIds])

  const selectedTradesInView = useMemo(() => {
    return filteredTrades.filter((trade) => visibleSelectedTradeIds.includes(trade.id))
  }, [filteredTrades, visibleSelectedTradeIds])

  const selectedOngoingTradeIds = useMemo(() => {
    const ongoingIds = new Set(ongoingTrades.map((trade) => trade.id))
    return visibleSelectedTradeIds.filter((id) => ongoingIds.has(id))
  }, [ongoingTrades, visibleSelectedTradeIds])

  const selectedCompletedTradeIds = useMemo(() => {
    const completedIds = new Set(completedTrades.map((trade) => trade.id))
    return visibleSelectedTradeIds.filter((id) => completedIds.has(id))
  }, [completedTrades, visibleSelectedTradeIds])

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
        mev: 0,
      }
    }

    const closedTrades = statsTrades.filter((trade) => trade.avg_exit !== null)
    const winners = closedTrades.filter((trade) => isWinOutcome(trade.r_multiple, breakEvenRThreshold, true))
    const losers = closedTrades.filter((trade) => isLossOutcome(trade.r_multiple, breakEvenRThreshold, true))
    const totalProfit = statsTrades.reduce((sum, trade) => sum + (trade.realised_win ?? 0), 0)
    const totalLoss = statsTrades.reduce((sum, trade) => sum + (trade.realised_loss ?? 0), 0)

    const totalR = statsTrades.reduce((sum, trade) => sum + (trade.r_multiple ?? 0), 0)
    const decisiveTrades = winners.length + losers.length
    const winRate = decisiveTrades > 0 ? winners.length / decisiveTrades : 0
    const lossRate = decisiveTrades > 0 ? losers.length / decisiveTrades : 0
    const averageWinR = winners.length > 0
      ? winners.reduce((sum, trade) => sum + (trade.r_multiple ?? 0), 0) / winners.length
      : 0
    const averageLossR = losers.length > 0
      ? Math.abs(losers.reduce((sum, trade) => sum + (trade.r_multiple ?? 0), 0) / losers.length)
      : 0
    const expectedValue = (winRate * averageWinR) - (lossRate * averageLossR)
    const monthsTraded = calculateMonthsTraded(statsTrades.map((trade) => normalizeTradeDate(trade.trade_date)))
    const mev = monthsTraded > 0 ? (expectedValue * totalTrades) / monthsTraded : 0

    return {
      totalTrades,
      winRate: winRate * 100,
      netPnL: totalProfit - totalLoss,
      totalR,
      expectedValue,
      mev,
    }
  }, [breakEvenRThreshold, statsTrades])

  const periodRStats = useMemo<PeriodRStats>(() => {
    const todayRange = getUtcPresetRange('today')
    const weekRange = getUtcPresetRange('this_week')
    const monthRange = getUtcPresetRange('this_month')
    const last90DaysRange = getUtcPresetRange('last_90_days')
    const yearRange = getUtcPresetRange('this_year')
    const previousYear = new Date().getUTCFullYear() - 1
    const previousYearStart = `${previousYear}-01-01`
    const previousYearEnd = `${previousYear}-12-31`

    const sumRInRange = (start: string, end: string): number => {
      return statsTrades.reduce((sum, trade) => {
        const tradeDate = normalizeTradeDate(trade.trade_date)
        if (!tradeDate) return sum
        if (tradeDate < start || tradeDate > end) return sum
        return sum + (trade.r_multiple ?? 0)
      }, 0)
    }

    return {
      today: sumRInRange(todayRange.start ?? '9999-12-31', todayRange.end ?? '9999-12-31'),
      week: sumRInRange(weekRange.start ?? '9999-12-31', weekRange.end ?? '9999-12-31'),
      month: sumRInRange(monthRange.start ?? '9999-12-31', monthRange.end ?? '9999-12-31'),
      last90Days: sumRInRange(last90DaysRange.start ?? '9999-12-31', last90DaysRange.end ?? '9999-12-31'),
      year: sumRInRange(yearRange.start ?? '9999-12-31', yearRange.end ?? '9999-12-31'),
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

    statsTrades.forEach((trade) => {
      const tradePnL = (trade.realised_win ?? 0) - (trade.realised_loss ?? 0)

      const systemKey = trade.system_id ?? '__unassigned__'
      systemTotals.set(systemKey, (systemTotals.get(systemKey) ?? 0) + tradePnL)

      const assetKey = trade.coin?.trim() || 'Unknown'
      assetTotals.set(assetKey, (assetTotals.get(assetKey) ?? 0) + tradePnL)
    })

    const { weekdayTotals, hourTotals } = buildTimingTotals(
      statsTrades,
      (trade) => (trade.realised_win ?? 0) - (trade.realised_loss ?? 0),
      (trade) => trade.trade_date,
      (trade) => trade.trade_time,
    )

    function resolveSystemLabel(systemId: string): string {
      if (systemId === '__unassigned__') return 'Unassigned'
      const system = systems.find((item) => item.id === systemId)
      return system?.name || '-'
    }

    const bestDay = pickBestTimingEntry(weekdayTotals)
    const worstDay = pickWorstTimingEntry(weekdayTotals)
    const bestHour = pickBestTimingEntry(hourTotals)
    const secondBestHour = pickSecondBestTimingEntry(hourTotals)
    const worstHour = pickWorstTimingEntry(hourTotals)
    const secondWorstHour = pickSecondWorstTimingEntry(hourTotals)

    function toPerformanceEntry(entry: { label: string; total: number } | null): PerformanceEntry | null {
      if (!entry) return null
      return { label: entry.label, netPnL: entry.total }
    }

    return {
      bestSystem: toPerformanceEntry(pickBestTimingEntry(systemTotals, resolveSystemLabel)),
      worstSystem: toPerformanceEntry(pickWorstTimingEntry(systemTotals, resolveSystemLabel)),
      bestAsset: toPerformanceEntry(pickBestTimingEntry(assetTotals)),
      worstAsset: toPerformanceEntry(pickWorstTimingEntry(assetTotals)),
      bestDay: toPerformanceEntry(bestDay),
      worstDay: toPerformanceEntry(worstDay),
      bestHour: toPerformanceEntry(bestHour),
      secondBestHour: toPerformanceEntry(secondBestHour),
      worstHour: toPerformanceEntry(worstHour),
      secondWorstHour: toPerformanceEntry(secondWorstHour),
    }
  }, [statsTrades, systems])

  const timingBuckets = useMemo(
    () => aggregateTimingBuckets(
      statsTrades,
      (trade) => (trade.realised_win ?? 0) - (trade.realised_loss ?? 0),
      (trade) => trade.trade_date,
      (trade) => trade.trade_time,
    ),
    [statsTrades],
  )

  const timingBreakdownFiltersActive = statsTrades.length !== trades.length

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

  async function handleBulkDeleteSelectedTrades(tradeIds: string[]) {
    if (tradeIds.length === 0) return

    const confirmed = window.confirm(
      `Delete ${tradeIds.length} selected trade${tradeIds.length === 1 ? '' : 's'}? This action cannot be undone.`,
    )

    if (!confirmed) return

    try {
      await deleteTradesBulk(tradeIds)
      await refreshData()
      setSelectedTradeIds((prev) => prev.filter((id) => !tradeIds.includes(id)))
      setOpenDeleteMenuTradeId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete selected trades')
    }
  }

  function openBulkEditModal(tradeIds: string[]) {
    if (tradeIds.length === 0) return

    setBulkEditTradeIds(tradeIds)
    setBulkEditSystemMode('unchanged')
    setBulkEditSystemId('')
    setBulkEditRiskMode('unchanged')
    setBulkEditRiskValue('')
    setBulkEditError(null)
    setIsBulkEditModalOpen(true)
  }

  function closeBulkEditModal() {
    if (bulkEditSaving) return

    setIsBulkEditModalOpen(false)
    setBulkEditTradeIds([])
    setBulkEditError(null)
  }

  async function handleBulkEditSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (bulkEditTradeIds.length === 0) return

    const updates: TradeUpdate = {}

    if (bulkEditSystemMode === 'no_system') {
      updates.system_id = null
      updates.sub_system_id = null
    }

    if (bulkEditSystemMode === 'set_system') {
      if (!bulkEditSystemId) {
        setBulkEditError('Select a system to apply.')
        return
      }

      updates.system_id = bulkEditSystemId
      updates.sub_system_id = null
    }

    if (bulkEditRiskMode === 'clear') {
      updates.risk = null
    }

    if (bulkEditRiskMode === 'set') {
      const parsedRisk = Number(bulkEditRiskValue)
      if (!Number.isFinite(parsedRisk) || parsedRisk <= 0) {
        setBulkEditError('Enter a valid risk amount greater than 0.')
        return
      }

      updates.risk = parsedRisk
    }

    if (Object.keys(updates).length === 0) {
      setBulkEditError('Choose at least one field to update.')
      return
    }

    setBulkEditSaving(true)
    setBulkEditError(null)

    try {
      const selectedTrades = trades.filter((trade) => bulkEditTradeIds.includes(trade.id))
      const needsRiskRecalculation = Object.prototype.hasOwnProperty.call(updates, 'risk')

      if (needsRiskRecalculation) {
        await Promise.all(
          selectedTrades.map((trade) => {
            const nextRisk = updates.risk ?? null
            const nextRMultiple = calculateTradeRMultiple(trade, nextRisk)

            return updateTrade(trade.id, {
              ...updates,
              r_multiple: nextRMultiple,
            })
          }),
        )
      } else {
        await updateTradesBulk(bulkEditTradeIds, updates)
      }

      await refreshData()
      setSelectedTradeIds((prev) => prev.filter((id) => !bulkEditTradeIds.includes(id)))
      closeBulkEditModal()
    } catch (err) {
      setBulkEditError(err instanceof Error ? err.message : 'Failed to update selected trades')
    } finally {
      setBulkEditSaving(false)
    }
  }

  // Format date and time as "DD/MM/YY HH:mm"
  function formatTradeDateTime(trade: Trade): string {
    const normalizedTime = normalizeDisplayTime(trade.trade_time)
    const parsed = new Date(`${trade.trade_date}T${normalizedTime}`)

    if (Number.isNaN(parsed.getTime())) {
      return `${trade.trade_date} ${normalizedTime.slice(0, 5)}`
    }

    const day = String(parsed.getDate()).padStart(2, '0')
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const year = String(parsed.getFullYear()).slice(-2)
    const hours = String(parsed.getHours()).padStart(2, '0')
    const minutes = String(parsed.getMinutes()).padStart(2, '0')

    return `${day}/${month}/${year} ${hours}:${minutes}`
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
    return tradeIds.length > 0 && tradeIds.every((tradeId) => visibleSelectedTradeIds.includes(tradeId))
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

  function getNextFloatingWidgetPosition(indexSeed: number): { x: number; y: number } {
    const fallbackX = 24 + ((indexSeed * 28) % 220)
    const fallbackY = 72 + ((indexSeed * 24) % 180)

    if (typeof window === 'undefined') {
      return { x: fallbackX, y: fallbackY }
    }

    const maxX = Math.max(FLOATING_WIDGET_MARGIN, window.innerWidth - FLOATING_WIDGET_DEFAULT_WIDTH - FLOATING_WIDGET_MARGIN)
    const maxY = Math.max(FLOATING_WIDGET_MARGIN, window.innerHeight - FLOATING_WIDGET_DEFAULT_HEIGHT - FLOATING_WIDGET_MARGIN)

    return {
      x: clamp(fallbackX, FLOATING_WIDGET_MARGIN, maxX),
      y: clamp(fallbackY, FLOATING_WIDGET_MARGIN, maxY),
    }
  }

  function handleViewChart(trade: Trade) {
    if (!premiumLoading && !isPremium) {
      redirectToPremium('chart-view')
      return
    }

    setFloatingChartWidgets((prev) => {
      const existing = prev.find((widget) => widget.trade.id === trade.id)
      const nextZIndex = topChartWidgetZIndex + 1

      if (existing) {
        setTopChartWidgetZIndex(nextZIndex)
        return prev.map((widget) =>
          widget.widgetId === existing.widgetId
            ? { ...widget, zIndex: nextZIndex }
            : widget,
        )
      }

      const position = getNextFloatingWidgetPosition(prev.length)
      setTopChartWidgetZIndex(nextZIndex)

      return [
        ...prev,
        {
          widgetId: `${trade.id}-${Date.now()}`,
          trade,
          systemLabel: getSystemName(trade.system_id),
          x: position.x,
          y: position.y,
          width: FLOATING_WIDGET_DEFAULT_WIDTH,
          height: FLOATING_WIDGET_DEFAULT_HEIGHT,
          zIndex: nextZIndex,
        },
      ]
    })
  }

  function handleCloseFloatingChartWidget(widgetId: string) {
    setFloatingChartWidgets((prev) => prev.filter((widget) => widget.widgetId !== widgetId))
  }

  function bringFloatingChartWidgetToFront(widgetId: string) {
    const nextZIndex = topChartWidgetZIndex + 1
    setTopChartWidgetZIndex(nextZIndex)
    setFloatingChartWidgets((prev) =>
      prev.map((widget) =>
        widget.widgetId === widgetId
          ? { ...widget, zIndex: nextZIndex }
          : widget,
      ),
    )
  }

  function handleMoveFloatingChartWidget(widgetId: string, x: number, y: number) {
    setFloatingChartWidgets((prev) =>
      prev.map((widget) =>
        widget.widgetId === widgetId
          ? { ...widget, x, y }
          : widget,
      ),
    )
  }

  function handleResizeFloatingChartWidget(widgetId: string, width: number, height: number) {
    setFloatingChartWidgets((prev) =>
      prev.map((widget) =>
        widget.widgetId === widgetId
          ? { ...widget, width, height }
          : widget,
      ),
    )
  }

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

  function applyDatePreset(preset: DateRangePreset) {
    if (preset === 'all') {
      setSelectedDateRangePreset('all')
      setCustomStartDate('')
      setCustomEndDate('')
      return
    }

    if (preset === 'custom') {
      setSelectedDateRangePreset('custom')
      return
    }

    const range = getUtcPresetRange(preset)
    setSelectedDateRangePreset(preset)
    setCustomStartDate(range.start ?? '')
    setCustomEndDate(range.end ?? '')
  }

  function handleCustomStartDateChange(value: string) {
    setSelectedDateRangePreset(value || customEndDate ? 'custom' : 'all')
    setCustomStartDate(value)
  }

  function handleCustomEndDateChange(value: string) {
    setSelectedDateRangePreset(customStartDate || value ? 'custom' : 'all')
    setCustomEndDate(value)
  }

  function clearDateRange() {
    applyDatePreset('all')
  }

  function resetFilters() {
    setSelectedSystemIds([])
    setSelectedSubSystemId('')
    setSelectedOutcomeFilter('all')
    setSelectedDirectionFilter('all')
    clearDateRange()
  }

  function toggleSystemFilterOption(systemId: string) {
    setSelectedSystemIds((prev) => {
      if (prev.includes(systemId)) {
        return prev.filter((id) => id !== systemId)
      }

      return [...prev, systemId]
    })
  }

  function clearSystemFilters() {
    setSelectedSystemIds([])
    setSelectedSubSystemId('')
  }

  function getSystemFilterSummaryLabel(): string {
    if (selectedSystemIds.length === 0) return 'All Systems'

    const includesNoSystem = selectedSystemIds.includes(UNASSIGNED_SYSTEM_FILTER)
    const selectedCount = selectedSystemIds.length - (includesNoSystem ? 1 : 0)

    if (includesNoSystem && selectedCount === 0) return 'No System'
    if (!includesNoSystem && selectedCount === 1) {
      const system = systems.find((item) => item.id === selectedSystemIds[0])
      return system?.name ?? '1 system selected'
    }

    if (includesNoSystem) {
      return `No System + ${selectedCount} system${selectedCount === 1 ? '' : 's'}`
    }

    return `${selectedCount} systems selected`
  }

  function handleOpenDecisions(trade: Trade) {
    setOpenDeleteMenuTradeId(null)
    setDecisionsTrade(trade)
  }

  function handleCloseDecisionsModal() {
    setDecisionsTrade(null)
  }

  function renderTradeRow(trade: Trade, selectable: boolean) {
    const outcomeCategory = classifyOutcomeR(trade.r_multiple, breakEvenRThreshold, trade.avg_exit !== null)
    const rColorClass = getOutcomeColorClass(outcomeCategory, 'r')
    const pnlColorClass = getOutcomeColorClass(outcomeCategory, 'pnl')

    return (
      <tr key={trade.id} className="border-t hover:bg-gray-50">
        {selectable && (
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={visibleSelectedTradeIds.includes(trade.id)}
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
        <td className="px-4 py-3 text-right">{trade.stop_loss ?? '-'}</td>
        <td className="px-4 py-3 text-right">{trade.avg_exit ?? '-'}</td>
        <td className={`px-4 py-3 text-right ${rColorClass}`}>{trade.r_multiple?.toFixed(2) ?? '-'}</td>
        <td className={`px-4 py-3 text-right ${pnlColorClass}`}>
          {trade.realised_win ? `+$${trade.realised_win}` : trade.realised_loss ? `-$${trade.realised_loss}` : '-'}
        </td>
        {showNotesColumn && (
          <td className="px-4 py-3 max-w-[260px] truncate" title={trade.notes ?? ''}>
            {trade.notes?.trim() || '-'}
          </td>
        )}
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
              onClick={() => handleOpenDecisions(trade)}
              className="px-2 py-1 text-xs text-sky-700 hover:text-sky-900 hover:underline"
            >
              Decisions
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
    <div className={`app-theme min-h-screen px-4 py-8 sm:px-6 lg:px-8 ${isDark ? 'app-dark bg-[#07111f] text-slate-100' : 'bg-[#f4f7f9]'}`}>
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
        <div className={`mb-6 rounded-lg border p-4 ${isDark ? 'border-slate-700 bg-slate-900/35' : 'border-gray-200 bg-gray-50'}`}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>System</label>
                <div className="relative" ref={systemFilterMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsSystemFilterMenuOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-gray-300 bg-white text-gray-900'}`}
                  >
                    <span className="truncate text-sm">{getSystemFilterSummaryLabel()}</span>
                    <span className="ml-3 text-xs">{isSystemFilterMenuOpen ? '▲' : '▼'}</span>
                  </button>

                  {isSystemFilterMenuOpen && (
                    <div className={`absolute z-30 mt-2 w-full rounded-lg border p-2 shadow-lg ${isDark ? 'border-slate-600 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                      <button
                        type="button"
                        onClick={clearSystemFilters}
                        className={`mb-2 w-full rounded-md px-2 py-1 text-left text-xs font-medium hover:opacity-90 ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-gray-100 text-gray-700'}`}
                      >
                        All Systems
                      </button>

                      <label className={`mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={selectedSystemIds.includes(UNASSIGNED_SYSTEM_FILTER)}
                          onChange={() => toggleSystemFilterOption(UNASSIGNED_SYSTEM_FILTER)}
                          className="h-4 w-4 cursor-pointer"
                        />
                        <span>No System</span>
                      </label>

                      <div className="max-h-44 overflow-auto">
                        {systems.map((system) => (
                          <label
                            key={system.id}
                            className={`mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSystemIds.includes(system.id)}
                              onChange={() => toggleSystemFilterOption(system.id)}
                              className="h-4 w-4 cursor-pointer"
                            />
                            <span className="truncate">{system.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Sub-System</label>
                <select
                  value={effectiveSelectedSubSystemId}
                  onChange={(e) => setSelectedSubSystemId(e.target.value)}
                  disabled={!singleSelectedSystemId}
                  className={`w-full rounded-lg border px-3 py-2 disabled:cursor-not-allowed ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100 disabled:bg-slate-900 disabled:text-slate-500' : 'border-gray-300 bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500'}`}
                >
                  <option value="">{singleSelectedSystemId ? 'All Sub-Systems' : 'Select exactly one system first'}</option>
                  {availableSubSystems.map((subSystem) => (
                    <option key={subSystem.id} value={subSystem.id}>{subSystem.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Outcome</label>
                <select
                  value={selectedOutcomeFilter}
                  onChange={(e) => setSelectedOutcomeFilter(e.target.value as 'all' | 'won' | 'lost' | 'be')}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-gray-300 bg-white text-gray-900'}`}
                >
                  <option value="all">All Trades</option>
                  <option value="won">Won Trades</option>
                  <option value="lost">Lost Trades</option>
                  <option value="be">BE Trades</option>
                </select>
              </div>

              <div>
                <label className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Direction</label>
                <select
                  value={selectedDirectionFilter}
                  onChange={(e) => setSelectedDirectionFilter(e.target.value as 'all' | 'long' | 'short')}
                  className={`w-full rounded-lg border px-3 py-2 ${isDark ? 'border-slate-600 bg-slate-950 text-slate-100' : 'border-gray-300 bg-white text-gray-900'}`}
                >
                  <option value="all">All Directions</option>
                  <option value="long">Long Trades</option>
                  <option value="short">Short Trades</option>
                </select>
              </div>
            </div>

            <DateRangePicker
              isDark={isDark}
              selectedPreset={selectedDateRangePreset}
              startDate={customStartDate}
              endDate={customEndDate}
              activeLabel={activeDateRange.label}
              isActive={activeDateRange.isActive}
              filteredTradeCount={filteredTrades.length}
              error={dateRangeError}
              onPresetChange={applyDatePreset}
              onStartDateChange={handleCustomStartDateChange}
              onEndDateChange={handleCustomEndDateChange}
              onClear={clearDateRange}
              onReset={resetFilters}
            />

            <div className="flex items-center justify-end">
              <label className={`inline-flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                <input
                  type="checkbox"
                  checked={showNotesColumn}
                  onChange={(event) => setShowNotesColumn(event.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                Show notes
              </label>
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
          label="MEV"
          value={`${stats.mev.toFixed(2)}R`}
          className={stats.mev >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <PeriodRCard
          stats={periodRStats}
          isDark={isDark}
          hasDateRangeSelected={activeDateRange.isActive}
          activeDateRangeLabel={activeDateRange.label}
          onClearDateRange={clearDateRange}
        />
        <BestPerformersCard
          stats={performanceStats}
          isDark={isDark}
          onViewTimingBreakdown={() => setIsTimingBreakdownOpen(true)}
        />
        <WorstPerformersCard
          stats={performanceStats}
          isDark={isDark}
          onViewTimingBreakdown={() => setIsTimingBreakdownOpen(true)}
        />
      </div>

      {/* Ongoing Trades Table */}
      <div className={`mb-6 overflow-hidden rounded-lg border ${isDark ? 'border-amber-400/20 bg-amber-300/8' : 'border-amber-200 bg-amber-50/40'}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? 'border-amber-400/20 bg-amber-300/12' : 'border-amber-200 bg-amber-100/40'}`}>
          <h2 className={`text-sm font-semibold ${isDark ? 'text-amber-100' : 'text-amber-900'}`}>Ongoing trades ({ongoingTrades.length})</h2>
          <div className="flex items-center gap-3">
            {selectedOngoingTradeIds.length > 0 && (
              <>
                <span className={`text-xs ${isDark ? 'text-amber-100/80' : 'text-amber-900/80'}`}>{selectedOngoingTradeIds.length} selected</span>
                <button
                  onClick={() => openBulkEditModal(selectedOngoingTradeIds)}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                >
                  Edit Selected
                </button>
                <button
                  onClick={() => handleBulkDeleteSelectedTrades(selectedOngoingTradeIds)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedTradeIds((prev) => prev.filter((id) => !selectedOngoingTradeIds.includes(id)))}
                  className={`cursor-pointer text-xs hover:underline ${isDark ? 'text-amber-100/80 hover:text-amber-50' : 'text-amber-900/80 hover:text-amber-950'}`}
                >
                  Clear
                </button>
              </>
            )}
            {ongoingTrades.length > 0 && (
              <button
                onClick={() => toggleSelectAllTrades(ongoingTrades.map((trade) => trade.id))}
                className={`cursor-pointer text-xs hover:underline ${isDark ? 'text-amber-100/80 hover:text-amber-50' : 'text-amber-900/80 hover:text-amber-950'}`}
              >
                {areAllTradesSelected(ongoingTrades.map((trade) => trade.id)) ? 'Unselect all' : 'Select all'}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-sm">
            <thead className={isDark ? 'bg-amber-300/10' : 'bg-amber-50'}>
            <tr>
              <th className="px-4 py-3 text-left" />
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={toggleDateSortDirection}
                  className={`cursor-pointer text-left hover:underline ${isDark ? 'text-amber-50' : ''}`}
                >
                  {dateSortLabel()}
                </button>
              </th>
              <th className="px-4 py-3 text-left">System</th>
              <th className="px-4 py-3 text-left">Coin</th>
              <th className="px-4 py-3 text-left">Direction</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Stop Loss</th>
              <th className="px-4 py-3 text-right">Exit</th>
              <th className="px-4 py-3 text-right">R-Multiple</th>
              <th className="px-4 py-3 text-right">P&L</th>
              {showNotesColumn && <th className="px-4 py-3 text-left">Notes</th>}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
            </thead>
            <tbody>
              {ongoingTrades.map((trade) => renderTradeRow(trade, true))}
              {ongoingTrades.length === 0 && (
                <tr>
                  <td colSpan={showNotesColumn ? 13 : 12} className={`px-4 py-8 text-center ${isDark ? 'text-amber-100/70' : 'text-gray-500'}`}>
                    No ongoing trades in this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Completed Trades Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-700">Closed trades ({completedTrades.length})</h2>
          <div className="flex items-center gap-3">
            {selectedCompletedTradeIds.length > 0 && (
              <>
                <span className="text-xs text-gray-600">{selectedCompletedTradeIds.length} selected</span>
                <button
                  onClick={() => openBulkEditModal(selectedCompletedTradeIds)}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                >
                  Edit Selected
                </button>
                <button
                  onClick={() => handleBulkDeleteSelectedTrades(selectedCompletedTradeIds)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete Selected
                </button>
                <button
                  onClick={() => setSelectedTradeIds((prev) => prev.filter((id) => !selectedCompletedTradeIds.includes(id)))}
                  className="text-xs text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </>
            )}
            {completedTrades.length > 0 && (
              <button
                onClick={() => toggleSelectAllTrades(completedTrades.map((trade) => trade.id))}
                className="text-xs text-gray-600 hover:text-gray-900 hover:underline cursor-pointer"
              >
                {areAllTradesSelected(completedTrades.map((trade) => trade.id)) ? 'Unselect all' : 'Select all'}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-sm">
            <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left" />
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={toggleDateSortDirection}
                  className="cursor-pointer text-left hover:underline"
                >
                  {dateSortLabel()}
                </button>
              </th>
              <th className="px-4 py-3 text-left">System</th>
              <th className="px-4 py-3 text-left">Coin</th>
              <th className="px-4 py-3 text-left">Direction</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Stop Loss</th>
              <th className="px-4 py-3 text-right">Exit</th>
              <th className="px-4 py-3 text-right">R-Multiple</th>
              <th className="px-4 py-3 text-right">P&L</th>
              {showNotesColumn && <th className="px-4 py-3 text-left">Notes</th>}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
            </thead>
            <tbody>
              {completedTrades.map((trade) => renderTradeRow(trade, true))}
              {completedTrades.length === 0 && (
                <tr>
                  <td colSpan={showNotesColumn ? 13 : 12} className="px-4 py-8 text-center text-gray-500">
                    No closed trades in this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Add/Edit Trade */}
      {userId && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          draggable
          dragHandleSelector="[data-modal-drag-handle='live-trade-form']"
        >
          <TradeForm
            trade={selectedTrade}
            onClose={handleCloseModal}
            onSuccess={handleFormSuccess}
            userId={userId}
          />
        </Modal>
      )}

      {userId && closingTrade && (
        <Modal isOpen={isCloseModalOpen} onClose={handleCloseTradeModal}>
          <CloseTradeForm
            trade={closingTrade}
            userId={userId}
            onClose={handleCloseTradeModal}
            onSuccess={handleFormSuccess}
          />
        </Modal>
      )}

      {userId && decisionsTrade && (
        <Modal
          isOpen={Boolean(decisionsTrade)}
          onClose={handleCloseDecisionsModal}
          contentClassName="max-w-xl overflow-hidden"
          innerClassName="p-0"
        >
          <TradeDecisionsModal
            trade={decisionsTrade}
            systems={systems}
            userId={userId}
            onClose={handleCloseDecisionsModal}
          />
        </Modal>
      )}

      <TimingBreakdownModal
        isOpen={isTimingBreakdownOpen}
        onClose={() => setIsTimingBreakdownOpen(false)}
        weekdayBuckets={timingBuckets.weekdays}
        hourBuckets={timingBuckets.hours}
        tradeCount={statsTrades.length}
        metricLabel="$ P&L"
        valueFormatter={formatTimingDollarValue}
        filtersActive={timingBreakdownFiltersActive}
      />

      {userId && (
        <Modal isOpen={isImportModalOpen} onClose={handleCloseImportModal}>
          <ImportTradesForm
            userId={userId}
            onClose={handleCloseImportModal}
            onSuccess={handleFormSuccess}
          />
        </Modal>
      )}

      <Modal isOpen={isBulkEditModalOpen} onClose={closeBulkEditModal}>
        <form onSubmit={handleBulkEditSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Bulk Edit Trades</h2>
              <p className="mt-1 text-sm text-gray-500">
                Apply the same system and/or risk update to {bulkEditTradeIds.length} selected trade{bulkEditTradeIds.length === 1 ? '' : 's'}.
              </p>
            </div>
            <button type="button" onClick={closeBulkEditModal} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          {bulkEditError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{bulkEditError}</div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">System update</label>
                <select
                  value={bulkEditSystemMode}
                  onChange={(e) => setBulkEditSystemMode(e.target.value as BulkEditSystemMode)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="unchanged">Leave system unchanged</option>
                  <option value="no_system">Set to No System</option>
                  <option value="set_system">Apply selected system</option>
                </select>
              </div>

              {bulkEditSystemMode === 'set_system' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Choose system</label>
                  <select
                    value={bulkEditSystemId}
                    onChange={(e) => setBulkEditSystemId(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >
                    <option value="">Select a system</option>
                    {systems.map((system) => (
                      <option key={system.id} value={system.id}>{system.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Sub-system will be cleared when system is updated in bulk.</p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Risk update</label>
                <select
                  value={bulkEditRiskMode}
                  onChange={(e) => setBulkEditRiskMode(e.target.value as BulkEditRiskMode)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="unchanged">Leave risk unchanged</option>
                  <option value="set">Set risk amount</option>
                  <option value="clear">Clear risk</option>
                </select>
              </div>

              {bulkEditRiskMode === 'set' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Risk amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bulkEditRiskValue}
                    onChange={(e) => setBulkEditRiskValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder="e.g. 50"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={bulkEditSaving}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkEditSaving ? 'Updating...' : 'Apply Changes'}
            </button>
            <button
              type="button"
              onClick={closeBulkEditModal}
              disabled={bulkEditSaving}
              className="rounded-lg border px-6 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
      </div>

      {floatingChartWidgets.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-40">
          {floatingChartWidgets.map((widget) => (
            <FloatingChartWidget
              key={widget.widgetId}
              widget={widget}
              onClose={handleCloseFloatingChartWidget}
              onMove={handleMoveFloatingChartWidget}
              onResize={handleResizeFloatingChartWidget}
              onBringToFront={bringFloatingChartWidgetToFront}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function calculateTradeRMultiple(trade: Trade, nextRisk: number | null): number | null {
  if (nextRisk === null || nextRisk <= 0) return null

  if (trade.realised_win !== null && trade.realised_win > 0) {
    return trade.realised_win / nextRisk
  }

  if (trade.realised_loss !== null && trade.realised_loss > 0) {
    return -trade.realised_loss / nextRisk
  }

  return null
}

function FloatingChartWidget({
  widget,
  onClose,
  onMove,
  onResize,
  onBringToFront,
}: {
  widget: FloatingChartWidgetState
  onClose: (widgetId: string) => void
  onMove: (widgetId: string, x: number, y: number) => void
  onResize: (widgetId: string, width: number, height: number) => void
  onBringToFront: (widgetId: string) => void
}) {
  function handleDragStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()
    onBringToFront(widget.widgetId)

    const startX = event.clientX
    const startY = event.clientY
    const initialX = widget.x
    const initialY = widget.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const maxX = Math.max(FLOATING_WIDGET_MARGIN, window.innerWidth - widget.width - FLOATING_WIDGET_MARGIN)
      const maxY = Math.max(FLOATING_WIDGET_MARGIN, window.innerHeight - widget.height - FLOATING_WIDGET_MARGIN)
      const nextX = clamp(initialX + (moveEvent.clientX - startX), FLOATING_WIDGET_MARGIN, maxX)
      const nextY = clamp(initialY + (moveEvent.clientY - startY), FLOATING_WIDGET_MARGIN, maxY)
      onMove(widget.widgetId, nextX, nextY)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleResizeStart(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    onBringToFront(widget.widgetId)

    const startX = event.clientX
    const startY = event.clientY
    const initialWidth = widget.width
    const initialHeight = widget.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const maxWidth = Math.max(FLOATING_WIDGET_MIN_WIDTH, window.innerWidth - widget.x - FLOATING_WIDGET_MARGIN)
      const maxHeight = Math.max(FLOATING_WIDGET_MIN_HEIGHT, window.innerHeight - widget.y - FLOATING_WIDGET_MARGIN)
      const nextWidth = clamp(initialWidth + (moveEvent.clientX - startX), FLOATING_WIDGET_MIN_WIDTH, maxWidth)
      const nextHeight = clamp(initialHeight + (moveEvent.clientY - startY), FLOATING_WIDGET_MIN_HEIGHT, maxHeight)
      onResize(widget.widgetId, nextWidth, nextHeight)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className="pointer-events-auto absolute overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl"
      style={{
        width: widget.width,
        height: widget.height,
        left: widget.x,
        top: widget.y,
        zIndex: widget.zIndex,
      }}
      onMouseDown={() => onBringToFront(widget.widgetId)}
    >
      <div
        className="flex h-11 cursor-move items-center justify-between border-b border-slate-200 bg-slate-900 px-3 text-white"
        onMouseDown={handleDragStart}
      >
        <p className="truncate text-sm font-medium">
          #{widget.trade.trade_number} · {widget.trade.coin.toUpperCase()} · {widget.trade.direction.toUpperCase()}
        </p>
        <button
          type="button"
          onClick={() => onClose(widget.widgetId)}
          className="rounded px-2 py-1 text-xs text-slate-200 hover:bg-white/10 hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="h-[calc(100%-2.75rem)] overflow-auto p-3">
        <TradeChartView
          trade={widget.trade}
          systemLabel={widget.systemLabel}
          onClose={() => onClose(widget.widgetId)}
        />
      </div>
      <div
        className="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize"
        onMouseDown={handleResizeStart}
      />
    </div>
  )
}

function toUtcDateString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftUtcDays(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted
}

function getUtcPresetRange(preset: Exclude<DateRangePreset, 'all' | 'custom'>): Omit<ActiveDateRange, 'isActive'> {
  const now = new Date()
  const today = toUtcDateString(now)

  if (preset === 'today') {
    return {
      start: today,
      end: today,
      label: today,
    }
  }

  if (preset === 'this_week') {
    const startOfWeek = new Date(now)
    const dayOfWeek = startOfWeek.getUTCDay()
    const daysFromMonday = (dayOfWeek + 6) % 7
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - daysFromMonday)
    const start = toUtcDateString(startOfWeek)

    return {
      start,
      end: today,
      label: formatDateRangeLabel(start, today),
    }
  }

  if (preset === 'this_month') {
    const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

    return {
      start,
      end: today,
      label: formatDateRangeLabel(start, today),
    }
  }

  if (preset === 'last_30_days') {
    const start = toUtcDateString(shiftUtcDays(now, -29))

    return {
      start,
      end: today,
      label: formatDateRangeLabel(start, today),
    }
  }

  if (preset === 'last_90_days') {
    const start = toUtcDateString(shiftUtcDays(now, -89))

    return {
      start,
      end: today,
      label: formatDateRangeLabel(start, today),
    }
  }

  const start = `${now.getUTCFullYear()}-01-01`
  return {
    start,
    end: today,
    label: formatDateRangeLabel(start, today),
  }
}

function formatDateRangeLabel(start: string | null, end: string | null): string {
  if (start && end) return `${start} -> ${end}`
  if (start) return `${start} onward`
  if (end) return `Until ${end}`
  return 'All time'
}

function isDateWithinRange(tradeDate: string | null, start: string | null, end: string | null): boolean {
  if (!start && !end) return true
  if (!tradeDate) return false
  if (start && tradeDate < start) return false
  if (end && tradeDate > end) return false
  return true
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
  return toUtcDateString(fallback)
}

function calculateMonthsTraded(normalizedTradeDates: Array<string | null>): number {
  const validDates = normalizedTradeDates
    .filter((value): value is string => value !== null)
    .sort((a, b) => a.localeCompare(b))

  if (validDates.length === 0) return 1

  const firstDate = new Date(`${validDates[0]}T00:00:00Z`)
  const lastDate = new Date(`${validDates[validDates.length - 1]}T00:00:00Z`)

  if (Number.isNaN(firstDate.getTime()) || Number.isNaN(lastDate.getTime())) return 1

  let months = (lastDate.getUTCFullYear() - firstDate.getUTCFullYear()) * 12
    + (lastDate.getUTCMonth() - firstDate.getUTCMonth())

  if (lastDate.getUTCDate() < firstDate.getUTCDate()) {
    months -= 1
  }

  return Math.max(1, months)
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

function getTradeDateTimeSortKey(trade: Trade): string {
  const normalizedDate = normalizeTradeDate(trade.trade_date)
  const normalizedTime = normalizeDisplayTime(trade.trade_time)

  if (!normalizedDate) {
    return `9999-12-31T${normalizedTime}`
  }

  return `${normalizedDate}T${normalizedTime}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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

function PeriodRCard({
  stats,
  isDark,
  hasDateRangeSelected,
  activeDateRangeLabel,
  onClearDateRange,
}: {
  stats: PeriodRStats
  isDark: boolean
  hasDateRangeSelected: boolean
  activeDateRangeLabel: string
  onClearDateRange: () => void
}) {
  const rows = [
    { label: 'Today', value: stats.today },
    { label: 'This Week', value: stats.week },
    { label: 'This Month', value: stats.month },
    { label: 'Last 90 Days', value: stats.last90Days },
    { label: 'This Year', value: stats.year },
    { label: 'Previous Year', value: stats.previousYear },
  ]

  return (
    <div className={`relative col-span-full overflow-hidden rounded-lg border p-4 ${isDark ? 'border-slate-700 bg-slate-950/70' : 'border-gray-200 bg-white'}`}>
      <div className={`mb-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Total R by Period</div>
      <div className={`grid grid-cols-2 divide-x md:grid-cols-6 ${isDark ? 'divide-slate-700' : 'divide-gray-200'}`}>
        {rows.map((row) => (
          <div key={row.label} className="px-4 py-2 text-center">
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{row.label}</div>
            <div className={`mt-1 text-lg font-semibold ${row.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {`${row.value >= 0 ? '+' : ''}${row.value.toFixed(2)}R`}
            </div>
          </div>
        ))}
      </div>

      {hasDateRangeSelected && (
        <>
          <div
            aria-hidden="true"
            className={`absolute inset-0 ${isDark ? 'bg-slate-950/58' : 'bg-white/72'}`}
          />
          <div className="absolute inset-x-4 top-4 flex justify-center">
            <div
              className={`w-full max-w-2xl rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${isDark ? 'border-sky-400/15 bg-slate-900/88 text-slate-100' : 'border-sky-200/90 bg-white/94 text-slate-900'}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                    Date Range Active
                  </p>
                  <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                    Period cards pause while you review a focused slice of trades.
                  </p>
                  <p className={`truncate text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{activeDateRangeLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={onClearDateRange}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${isDark ? 'bg-sky-400 text-slate-950 hover:bg-sky-300' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  Clear Date Range
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BestPerformersCard({
  stats,
  isDark,
  onViewTimingBreakdown,
}: {
  stats: PerformanceStats
  isDark: boolean
  onViewTimingBreakdown: () => void
}) {
  const rows = [
    { label: 'System', data: stats.bestSystem },
    { label: 'Asset', data: stats.bestAsset },
    { label: 'Day', data: stats.bestDay },
    { label: 'Time #1', data: stats.bestHour },
    { label: 'Time #2', data: stats.secondBestHour },
  ]

  return (
    <div className={`border rounded-lg p-4 col-span-full lg:col-span-3 ${isDark ? 'border-white/10 bg-white/5' : 'bg-white'}`}>
      <div className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Best Performers</div>
      <div className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center gap-3">
            <span className={`truncate ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{row.label}</span>
            {row.data ? (
              <span className="text-green-600 font-medium text-right">
                {`${row.data.label} (${row.data.netPnL >= 0 ? '+' : ''}$${row.data.netPnL.toFixed(2)})`}
              </span>
            ) : (
              <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>-</span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onViewTimingBreakdown}
        className={`mt-3 text-xs font-medium hover:underline ${isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-700 hover:text-sky-900'}`}
      >
        View timing breakdown →
      </button>
    </div>
  )
}

function WorstPerformersCard({
  stats,
  isDark,
  onViewTimingBreakdown,
}: {
  stats: PerformanceStats
  isDark: boolean
  onViewTimingBreakdown: () => void
}) {
  const rows = [
    { label: 'System', data: stats.worstSystem },
    { label: 'Asset', data: stats.worstAsset },
    { label: 'Day', data: stats.worstDay },
    { label: 'Time #1', data: stats.worstHour },
    { label: 'Time #2', data: stats.secondWorstHour },
  ]

  return (
    <div className={`border rounded-lg p-4 col-span-full lg:col-span-3 ${isDark ? 'border-white/10 bg-white/5' : 'bg-white'}`}>
      <div className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Worst Performers</div>
      <div className="space-y-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center gap-3">
            <span className={`truncate ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{row.label}</span>
            {row.data ? (
              <span className="text-red-600 font-medium text-right">
                {`${row.data.label} (${row.data.netPnL >= 0 ? '+' : ''}$${row.data.netPnL.toFixed(2)})`}
              </span>
            ) : (
              <span className={isDark ? 'text-slate-500' : 'text-gray-400'}>-</span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onViewTimingBreakdown}
        className={`mt-3 text-xs font-medium hover:underline ${isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-700 hover:text-sky-900'}`}
      >
        View timing breakdown →
      </button>
    </div>
  )
}

function formatTimingDollarValue(value: number): string {
  return `${value >= 0 ? '+' : ''}$${value.toFixed(2)}`
}
