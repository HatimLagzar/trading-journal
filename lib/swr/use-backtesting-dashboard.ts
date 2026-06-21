import useSWR from 'swr'
import { getBacktestingSessions, getBacktestingTrades } from '@/services/backtesting'
import { getSystems } from '@/services/system'
import { cacheKeys } from '@/lib/swr/cache-keys'
import type { BacktestingSession, BacktestingTrade } from '@/services/backtesting'
import type { System } from '@/services/system'

export type BacktestingDashboardFallback = {
  systems?: System[]
  sessions?: BacktestingSession[]
  trades?: BacktestingTrade[]
  selectedSessionId?: string | null
}

export function useBacktestingSystems(userId: string, fallback?: System[]) {
  return useSWR(
    userId ? cacheKeys.systems(userId) : null,
    () => getSystems(userId),
    { fallbackData: fallback },
  )
}

export function useBacktestingSessions(userId: string, fallback?: BacktestingSession[]) {
  return useSWR(
    userId ? cacheKeys.backtestingSessions(userId) : null,
    () => getBacktestingSessions(userId),
    { fallbackData: fallback },
  )
}

export function useBacktestingSessionTrades(
  userId: string,
  sessionId: string | null,
  fallback?: BacktestingTrade[],
) {
  return useSWR(
    userId && sessionId ? cacheKeys.backtestingTrades(userId, sessionId) : null,
    () => getBacktestingTrades(userId, sessionId as string),
    { fallbackData: fallback },
  )
}

export function useBacktestingDashboard(
  userId: string,
  selectedSessionId: string | null,
  fallback?: BacktestingDashboardFallback,
) {
  const systemsQuery = useBacktestingSystems(userId, fallback?.systems)
  const sessionsQuery = useBacktestingSessions(userId, fallback?.sessions)
  const tradesQuery = useBacktestingSessionTrades(userId, selectedSessionId, fallback?.trades)

  const isLoading = Boolean(
    userId && (
      (systemsQuery.isLoading && systemsQuery.data === undefined)
      || (sessionsQuery.isLoading && sessionsQuery.data === undefined)
      || (selectedSessionId && tradesQuery.isLoading && tradesQuery.data === undefined)
    ),
  )

  const error = systemsQuery.error ?? sessionsQuery.error ?? tradesQuery.error

  async function refreshSessions() {
    await sessionsQuery.mutate()
  }

  async function refreshTrades() {
    await tradesQuery.mutate()
  }

  async function refreshAll() {
    await Promise.all([
      systemsQuery.mutate(),
      sessionsQuery.mutate(),
      tradesQuery.mutate(),
    ])
  }

  return {
    systems: systemsQuery.data ?? [],
    sessions: sessionsQuery.data ?? [],
    trades: tradesQuery.data ?? [],
    isLoading,
    isValidating: systemsQuery.isValidating || sessionsQuery.isValidating || tradesQuery.isValidating,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refreshSessions,
    refreshTrades,
    refreshAll,
  }
}
