export const cacheKeys = {
  trades: (userId: string) => ['trades', userId] as const,
  systems: (userId: string) => ['systems', userId] as const,
  subSystems: (userId: string) => ['sub-systems', userId] as const,
  backtestingSessions: (userId: string) => ['backtesting-sessions', userId] as const,
  backtestingTrades: (userId: string, sessionId: string) => ['backtesting-trades', userId, sessionId] as const,
}
