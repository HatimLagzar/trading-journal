'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getTrades, deleteTrade } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import type { Trade } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'
import Modal from './Modal'
import TradeForm from './TradeForm'
import type { User } from '@supabase/supabase-js'

type DashboardStats = {
  totalTrades: number
  winRate: number
  netPnL: number
  avgRMultiple: number
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
        avgRMultiple: 0,
      }
    }

    const winners = statsTrades.filter((trade) => (trade.realised_win ?? 0) > 0).length
    const totalProfit = statsTrades.reduce((sum, trade) => sum + (trade.realised_win ?? 0), 0)
    const totalLoss = statsTrades.reduce((sum, trade) => sum + (trade.realised_loss ?? 0), 0)

    const rValues = statsTrades
      .map((trade) => trade.r_multiple)
      .filter((value): value is number => value !== null)

    const avgRMultiple = rValues.length > 0
      ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length
      : 0

    return {
      totalTrades,
      winRate: (winners / totalTrades) * 100,
      netPnL: totalProfit - totalLoss,
      avgRMultiple,
    }
  }, [statsTrades])

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
        <h1 className="text-2xl font-bold">Trading Journal</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/systems')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Systems
          </button>
          <button
            onClick={handleAddTrade}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Trade
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

          <div className="text-sm text-gray-600">
            {selectedTradeIds.length > 0
              ? `Stats use ${selectedTradeIds.length} checked trade${selectedTradeIds.length > 1 ? 's' : ''}.`
              : 'No checkboxes selected: stats use the system/sub-system filter.'}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Trades" value={stats.totalTrades} />
        <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard
          label="Net P&L"
          value={`$${stats.netPnL.toFixed(2)}`}
          className={stats.netPnL >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard label="Avg R" value={stats.avgRMultiple.toFixed(2)} />
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
                <td className="px-4 py-3 text-gray-600">{getSystemName(trade.system_id)}</td>
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
                    <button
                      onClick={() => handleEditTrade(trade)}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTrade(trade)}
                      className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:underline"
                    >
                      Delete
                    </button>
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
