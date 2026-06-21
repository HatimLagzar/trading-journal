import useSWR from 'swr'
import { getSystems, getSubSystems } from '@/services/system'
import { cacheKeys } from '@/lib/swr/cache-keys'
import { EMPTY_SUB_SYSTEMS, EMPTY_SYSTEMS } from '@/lib/swr/empty-collections'
import type { SubSystem, System } from '@/services/system'

export type SystemsDashboardFallback = {
  systems?: System[]
  subSystems?: SubSystem[]
}

export function useSystemsDashboard(userId: string | null, fallback?: SystemsDashboardFallback) {
  const systemsQuery = useSWR(
    userId ? cacheKeys.systems(userId) : null,
    () => getSystems(userId as string),
    { fallbackData: fallback?.systems },
  )

  const subSystemsQuery = useSWR(
    userId ? cacheKeys.subSystems(userId) : null,
    () => getSubSystems(userId as string),
    { fallbackData: fallback?.subSystems },
  )

  const isLoading = Boolean(
    userId && (
      (systemsQuery.isLoading && systemsQuery.data === undefined)
      || (subSystemsQuery.isLoading && subSystemsQuery.data === undefined)
    ),
  )

  const error = systemsQuery.error ?? subSystemsQuery.error

  async function refresh() {
    await Promise.all([
      systemsQuery.mutate(),
      subSystemsQuery.mutate(),
    ])
  }

  return {
    systems: systemsQuery.data ?? EMPTY_SYSTEMS,
    subSystems: subSystemsQuery.data ?? EMPTY_SUB_SYSTEMS,
    isLoading,
    isValidating: systemsQuery.isValidating || subSystemsQuery.isValidating,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    refresh,
  }
}
