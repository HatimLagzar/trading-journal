import useSWR from 'swr'
import { getTrades } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import { cacheKeys } from '@/lib/swr/cache-keys'
import { EMPTY_SUB_SYSTEMS, EMPTY_SYSTEMS, EMPTY_TRADES } from '@/lib/swr/empty-collections'
import type { Trade } from '@/services/trade'
import type { SubSystem, System } from '@/services/system'

export type TradesDashboardFallback = {
  trades?: Trade[]
  systems?: System[]
  subSystems?: SubSystem[]
}

export function useTradesDashboard(userId: string, fallback?: TradesDashboardFallback) {
  const tradesQuery = useSWR(
    userId ? cacheKeys.trades(userId) : null,
    () => getTrades(userId),
    { fallbackData: fallback?.trades },
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

  const error = tradesQuery.error ?? systemsQuery.error ?? subSystemsQuery.error

  async function refresh() {
    await Promise.all([
      tradesQuery.mutate(),
      systemsQuery.mutate(),
      subSystemsQuery.mutate(),
    ])
  }

  return {
    trades: tradesQuery.data ?? EMPTY_TRADES,
    systems: systemsQuery.data ?? EMPTY_SYSTEMS,
    subSystems: subSystemsQuery.data ?? EMPTY_SUB_SYSTEMS,
    isLoading,
    isValidating: tradesQuery.isValidating || systemsQuery.isValidating || subSystemsQuery.isValidating,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refresh,
  }
}
