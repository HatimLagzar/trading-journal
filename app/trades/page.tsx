'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getTrades, getTradeStats, deleteTrade } from '@/lib/trades'
import type { Trade } from '@/lib/types'
import Modal from './Modal'
import TradeForm from './TradeForm'
import type { User } from '@supabase/supabase-js'

export default function TradesPage() {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [stats, setStats] = useState<{
    totalTrades: number
    winRate: number
    netPnL: number
    avgRMultiple: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Function to refresh trades and stats
  async function refreshData() {
    if (!user) return

    try {
      const [tradesData, statsData] = await Promise.all([
        getTrades(user.id),
        getTradeStats(user.id)
      ])
      setTrades(tradesData)
      setStats(statsData)
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
        const [tradesData, statsData] = await Promise.all([
          getTrades(user.id),
          getTradeStats(user.id)
        ])
        setTrades(tradesData)
        setStats(statsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trades')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

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
      // trade_time is in format 'HH:MM:SS', extract just 'HH:MM'
      const time = trade.trade_time.substring(0, 5)
      return `${dayName} ${time}`
    }
    
    // If no time, just return the day name
    return dayName
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Trading Journal</h1>
        <div className="flex gap-3">
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

      {/* Stats Summary */}
      {stats && (
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
      )}

      {/* Trades Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Date</th>
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
            {trades.map((trade) => (
              <tr key={trade.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">{trade.trade_number}</td>
                <td className="px-4 py-3">{formatTradeDateTime(trade)}</td>
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
            {trades.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No trades yet. Start journaling!
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
