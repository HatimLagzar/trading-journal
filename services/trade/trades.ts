import { supabase } from '@/lib/supabase/client'
import type {
  Trade,
  TradeAnalyticsRow,
  TradeInsert,
  TradePage,
  TradePageFilters,
  TradeUpdate,
} from './types'

const TRADE_FETCH_BATCH_SIZE = 500

// ============================================
// FETCH TRADES
// ============================================

// Get all trades for a user, newest first
export async function getTrades(userId: string) {
  const trades: Trade[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + TRADE_FETCH_BATCH_SIZE - 1)

    if (error) throw error
    trades.push(...data)

    if (data.length < TRADE_FETCH_BATCH_SIZE) break
    from += TRADE_FETCH_BATCH_SIZE
  }

  return trades
}

export async function getTradeAnalytics(userId: string): Promise<TradeAnalyticsRow[]> {
  const rows: TradeAnalyticsRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('trades')
      .select('id, trade_date, trade_time, coin, direction, avg_exit, realised_loss, realised_win, r_multiple, system_id, sub_system_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + TRADE_FETCH_BATCH_SIZE - 1)

    if (error) throw error
    rows.push(...data)

    if (data.length < TRADE_FETCH_BATCH_SIZE) break
    from += TRADE_FETCH_BATCH_SIZE
  }

  return rows
}

export async function getTradesPage(
  userId: string,
  page: number,
  pageSize: number,
  filters: TradePageFilters,
): Promise<TradePage> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  let query = supabase
    .from('trades')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  if (filters.systemIds.length > 0 && filters.includeUnassignedSystem) {
    query = query.or(`system_id.is.null,system_id.in.(${filters.systemIds.join(',')})`)
  } else if (filters.systemIds.length > 0) {
    query = query.in('system_id', filters.systemIds)
  } else if (filters.includeUnassignedSystem) {
    query = query.is('system_id', null)
  }

  if (filters.subSystemId) query = query.eq('sub_system_id', filters.subSystemId)
  if (filters.direction !== 'all') query = query.eq('direction', filters.direction)
  if (filters.asset) query = query.ilike('coin', filters.asset)
  if (filters.startDate) query = query.gte('trade_date', filters.startDate)
  if (filters.endDate) query = query.lte('trade_date', filters.endDate)

  if (filters.outcome !== 'all') {
    query = query.not('avg_exit', 'is', null)

    if (filters.outcome === 'won') {
      query = query.gt('r_multiple', filters.breakEvenRThreshold)
    } else if (filters.outcome === 'lost') {
      query = query.lt('r_multiple', -filters.breakEvenRThreshold)
    } else {
      query = query
        .gte('r_multiple', -filters.breakEvenRThreshold)
        .lte('r_multiple', filters.breakEvenRThreshold)
    }
  }

  if (filters.dateSortDirection === 'none') {
    query = query.order('created_at', { ascending: false })
  } else {
    const ascending = filters.dateSortDirection === 'asc'
    query = query
      .order('trade_date', { ascending })
      .order('trade_time', { ascending, nullsFirst: ascending })
      .order('created_at', { ascending })
  }

  const [pageResult, ongoingCount, closedCount] = await Promise.all([
    query.range(from, to),
    getFilteredTradeCount(userId, filters, false),
    getFilteredTradeCount(userId, filters, true),
  ])

  const { data, error, count } = pageResult

  if (error) throw error
  return {
    trades: data,
    count: count ?? 0,
    ongoingCount,
    closedCount,
  }
}

async function getFilteredTradeCount(
  userId: string,
  filters: TradePageFilters,
  isClosed: boolean,
): Promise<number> {
  let query = supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (filters.systemIds.length > 0 && filters.includeUnassignedSystem) {
    query = query.or(`system_id.is.null,system_id.in.(${filters.systemIds.join(',')})`)
  } else if (filters.systemIds.length > 0) {
    query = query.in('system_id', filters.systemIds)
  } else if (filters.includeUnassignedSystem) {
    query = query.is('system_id', null)
  }

  if (filters.subSystemId) query = query.eq('sub_system_id', filters.subSystemId)
  if (filters.direction !== 'all') query = query.eq('direction', filters.direction)
  if (filters.asset) query = query.ilike('coin', filters.asset)
  if (filters.startDate) query = query.gte('trade_date', filters.startDate)
  if (filters.endDate) query = query.lte('trade_date', filters.endDate)

  if (filters.outcome !== 'all') {
    query = query.not('avg_exit', 'is', null)

    if (filters.outcome === 'won') {
      query = query.gt('r_multiple', filters.breakEvenRThreshold)
    } else if (filters.outcome === 'lost') {
      query = query.lt('r_multiple', -filters.breakEvenRThreshold)
    } else {
      query = query
        .gte('r_multiple', -filters.breakEvenRThreshold)
        .lte('r_multiple', filters.breakEvenRThreshold)
    }
  }

  query = isClosed
    ? query.not('avg_exit', 'is', null)
    : query.is('avg_exit', null)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
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

export async function createTradesBulk(trades: TradeInsert[]) {
  if (trades.length === 0) return []

  const { data, error } = await supabase
    .from('trades')
    .insert(trades)
    .select()

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

export async function updateTradesBulk(ids: string[], updates: TradeUpdate) {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('trades')
    .update(updates)
    .in('id', ids)
    .select()

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

export async function deleteTradesBulk(ids: string[]) {
  if (ids.length === 0) return

  const { error } = await supabase
    .from('trades')
    .delete()
    .in('id', ids)

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
