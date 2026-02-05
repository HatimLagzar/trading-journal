import { supabase } from './supabase/client'
import type { Trade, TradeInsert, TradeUpdate } from './types'

// ============================================
// FETCH TRADES
// ============================================

// Get all trades for a user, newest first
export async function getTrades(userId: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('trade_date', { ascending: false })

  if (error) throw error
  return data
}

// Get a single trade by ID
export async function getTrade(id: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .single()  // Returns one object instead of array

  if (error) throw error
  return data
}

// Get trades for a date range
export async function getTradesByDateRange(
  userId: string,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .gte('trade_date', startDate)  // >= start
    .lte('trade_date', endDate)    // <= end
    .order('trade_date', { ascending: false })

  if (error) throw error
  return data
}

// ============================================
// CREATE TRADE
// ============================================

export async function createTrade(trade: TradeInsert) {
  const { data, error } = await supabase
    .from('trades')
    .insert(trade)
    .select()     // Return the created row
    .single()

  if (error) throw error
  return data
}

// ============================================
// UPDATE TRADE
// ============================================

export async function updateTrade(id: string, updates: TradeUpdate) {
  const { data, error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// DELETE TRADE
// ============================================

export async function deleteTrade(id: string) {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================
// STATS / AGGREGATIONS
// ============================================

// Get trading stats (you'd typically do this in SQL, but here's a client example)
export async function getTradeStats(userId: string) {
  const { data, error } = await supabase
    .from('trades')
    .select('realised_win, realised_loss, r_multiple')
    .eq('user_id', userId)

  if (error) throw error

  const totalTrades = data.length
  const winners = data.filter(t => t.realised_win && t.realised_win > 0).length
  const losers = data.filter(t => t.realised_loss && t.realised_loss > 0).length
  const winRate = totalTrades > 0 ? (winners / totalTrades) * 100 : 0

  const totalProfit = data.reduce((sum, t) => sum + (t.realised_win || 0), 0)
  const totalLoss = data.reduce((sum, t) => sum + (t.realised_loss || 0), 0)

  const avgRMultiple = data.filter(t => t.r_multiple !== null).length > 0
    ? data.reduce((sum, t) => sum + (t.r_multiple || 0), 0) / data.filter(t => t.r_multiple !== null).length
    : 0

  return {
    totalTrades,
    winners,
    losers,
    winRate,
    totalProfit,
    totalLoss,
    netPnL: totalProfit - totalLoss,
    avgRMultiple
  }
}
