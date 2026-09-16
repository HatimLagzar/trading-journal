export const cacheKeys = {
  tradeAnalytics: (userId: string) => ['trade-analytics', userId] as const,
  tradesPage: (userId: string, page: number, pageSize: number, filtersKey: string) =>
    ['trades-page', userId, page, pageSize, filtersKey] as const,
  systems: (userId: string) => ['systems', userId] as const,
  subSystems: (userId: string) => ['sub-systems', userId] as const,
  backtestingSessions: (userId: string) => ['backtesting-sessions', userId] as const,
  backtestingTrades: (userId: string, sessionId: string) => ['backtesting-trades', userId, sessionId] as const,
}
