import useSWR from 'swr'
import { getTradeAnalytics, getTradesPage } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import { cacheKeys } from '@/lib/swr/cache-keys'
import { EMPTY_SUB_SYSTEMS, EMPTY_SYSTEMS, EMPTY_TRADES } from '@/lib/swr/empty-collections'
import type { Trade, TradePageFilters } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'

export type TradesDashboardFallback = {
  trades?: Trade[]
  systems?: System[]
  subSystems?: SubSystem[]
}

export function useTradesDashboard(
  userId: string,
  page: number,
  pageSize: number,
  filters: TradePageFilters,
  fallback?: TradesDashboardFallback,
) {
  const filtersKey = JSON.stringify(filters)
  const tradesQuery = useSWR(
    userId ? cacheKeys.tradesPage(userId, page, pageSize, filtersKey) : null,
    () => getTradesPage(userId, page, pageSize, filters),
    fallback?.trades
      ? {
          fallbackData: {
            trades: fallback.trades,
            count: fallback.trades.length,
            ongoingCount: fallback.trades.filter((trade) => trade.avg_exit === null).length,
            closedCount: fallback.trades.filter((trade) => trade.avg_exit !== null).length,
          },
        }
      : undefined,
  )

  const analyticsQuery = useSWR(
    userId ? cacheKeys.tradeAnalytics(userId) : null,
    () => getTradeAnalytics(userId),
  )

  const systemsQuery = useSWR(
    userId ? cacheKeys.systems(userId) : null,
    () => getSystems(userId),
    { fallbackData: fallback?.systems },
  )

  const subSystemsQuery = useSWR(
    userId ? cacheKeys.subSystems(userId) : null,
    () => getSubSystems(userId),
    { fallbackData: fallback?.subSystems },
  )

  const isLoading = Boolean(
    userId && (
      (tradesQuery.isLoading && tradesQuery.data === undefined)
      || (systemsQuery.isLoading && systemsQuery.data === undefined)
      || (subSystemsQuery.isLoading && subSystemsQuery.data === undefined)
    ),
  )

  const error = tradesQuery.error ?? analyticsQuery.error ?? systemsQuery.error ?? subSystemsQuery.error

  async function refresh() {
    await Promise.all([
      tradesQuery.mutate(),
      analyticsQuery.mutate(),
      systemsQuery.mutate(),
      subSystemsQuery.mutate(),
    ])
  }

  return {
    trades: tradesQuery.data?.trades ?? EMPTY_TRADES,
    tradeCount: tradesQuery.data?.count ?? 0,
    ongoingTradeCount: tradesQuery.data?.ongoingCount ?? 0,
    closedTradeCount: tradesQuery.data?.closedCount ?? 0,
    analyticsTrades: analyticsQuery.data ?? EMPTY_TRADES,
    systems: systemsQuery.data ?? EMPTY_SYSTEMS,
    subSystems: subSystemsQuery.data ?? EMPTY_SUB_SYSTEMS,
    isLoading,
    isValidating: tradesQuery.isValidating || analyticsQuery.isValidating || systemsQuery.isValidating || subSystemsQuery.isValidating,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refresh,
  }
}
