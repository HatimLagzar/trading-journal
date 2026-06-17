export const DEFAULT_BREAK_EVEN_R_THRESHOLD = 0.01

export type TradeOutcomeCategory = 'win' | 'loss' | 'break_even' | 'open'

export function normalizeBreakEvenRThreshold(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_BREAK_EVEN_R_THRESHOLD
  }

  return value
}

export function classifyOutcomeR(
  rMultiple: number | null | undefined,
  threshold: number,
  isClosed = true,
): TradeOutcomeCategory {
  if (!isClosed || rMultiple === null || rMultiple === undefined) {
    return 'open'
  }

  const normalizedThreshold = normalizeBreakEvenRThreshold(threshold)

  if (Math.abs(rMultiple) <= normalizedThreshold) {
    return 'break_even'
  }

  return rMultiple > 0 ? 'win' : 'loss'
}

export function isWinOutcome(
  rMultiple: number | null | undefined,
  threshold: number,
  isClosed = true,
): boolean {
  return classifyOutcomeR(rMultiple, threshold, isClosed) === 'win'
}

export function isLossOutcome(
  rMultiple: number | null | undefined,
  threshold: number,
  isClosed = true,
): boolean {
  return classifyOutcomeR(rMultiple, threshold, isClosed) === 'loss'
}

export function isBreakEvenOutcome(
  rMultiple: number | null | undefined,
  threshold: number,
  isClosed = true,
): boolean {
  return classifyOutcomeR(rMultiple, threshold, isClosed) === 'break_even'
}

export function getOutcomeColorClass(
  category: TradeOutcomeCategory,
  variant: 'r' | 'pnl' = 'r',
): string {
  if (category === 'win') {
    return 'text-green-600'
  }

  if (category === 'loss') {
    return 'text-red-600'
  }

  if (category === 'break_even') {
    return variant === 'pnl' ? 'text-amber-600' : 'text-amber-600'
  }

  return ''
}
