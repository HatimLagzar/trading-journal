import { mutate } from 'swr'
import { getTradeAnalytics } from '@/services/trade'
import { getSystems, getSubSystems } from '@/services/system'
import { getBacktestingSessions } from '@/services/backtesting'
import { cacheKeys } from '@/lib/swr/cache-keys'

export function prefetchTradesDashboard(userId: string) {
  void mutate(cacheKeys.tradeAnalytics(userId), () => getTradeAnalytics(userId))
  void mutate(cacheKeys.systems(userId), () => getSystems(userId))
  void mutate(cacheKeys.subSystems(userId), () => getSubSystems(userId))
}

export function prefetchSystemsDashboard(userId: string) {
  void mutate(cacheKeys.systems(userId), () => getSystems(userId))
  void mutate(cacheKeys.subSystems(userId), () => getSubSystems(userId))
}

export function prefetchBacktestingDashboard(userId: string) {
  void mutate(cacheKeys.systems(userId), () => getSystems(userId))
  void mutate(cacheKeys.backtestingSessions(userId), () => getBacktestingSessions(userId))
}
