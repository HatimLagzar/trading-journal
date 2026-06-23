const CURRENCY_SUFFIX_PATTERN = /\b(?:USD|USDT|USDC|EUR|GBP|AUD|CAD|JPY|CHF|NZD|BTC|ETH)\b/gi

export function parsePriceInput(value: string): number | null {
  if (!value) return null

  let cleaned = value.trim().replace(/−/g, '-')
  if (!cleaned) return null

  let negative = false
  if (/^\(.*\)$/.test(cleaned)) {
    negative = true
    cleaned = cleaned.slice(1, -1).trim()
  }

  if (cleaned.startsWith('-')) {
    negative = true
    cleaned = cleaned.slice(1).trim()
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1).trim()
  }

  cleaned = cleaned
    .replace(CURRENCY_SUFFIX_PATTERN, '')
    .replace(/[$€£¥₿₹\s]/g, '')

  if (!cleaned) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    const afterComma = cleaned.slice(lastComma + 1)
    if (/^\d{1,2}$/.test(afterComma)) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (lastDot !== -1) {
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      const decimalPart = parts.pop() ?? ''
      cleaned = `${parts.join('')}.${decimalPart}`
    }
  }

  cleaned = cleaned.replace(/[.,]$/, '')

  if (!cleaned) return null

  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null

  return negative ? -parsed : parsed
}

export function formatPriceInputValue(value: number | null): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function normalizePriceInputString(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const parsed = parsePriceInput(trimmed)
  if (parsed === null) return value

  return String(parsed)
}
