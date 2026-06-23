'use client'

import type { InputHTMLAttributes } from 'react'
import { formatPriceInputValue, normalizePriceInputString, parsePriceInput } from '@/lib/parse-price-input'

type SharedProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'value' | 'onChange' | 'onPaste'>

type NumericPriceInputProps = SharedProps & {
  valueMode?: 'number'
  value: number | null
  onValueChange: (value: number | null) => void
  fallbackValue?: number | null
}

type StringPriceInputProps = SharedProps & {
  valueMode: 'string'
  value: string
  onValueChange: (value: string) => void
}

export type PriceInputProps = NumericPriceInputProps | StringPriceInputProps

export default function PriceInput(props: PriceInputProps) {
  if (props.valueMode === 'string') {
    const { value, onValueChange, valueMode: _valueMode, ...rest } = props

    return (
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          const raw = event.target.value
          if (!raw.trim()) {
            onValueChange('')
            return
          }

          onValueChange(normalizePriceInputString(raw))
        }}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData('text')
          if (!pasted.trim()) return

          const parsed = parsePriceInput(pasted)
          if (parsed === null) return

          event.preventDefault()
          onValueChange(String(parsed))
        }}
      />
    )
  }

  const {
    value,
    onValueChange,
    fallbackValue = null,
    valueMode: _valueMode,
    ...rest
  } = props

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={formatPriceInputValue(value)}
      onChange={(event) => {
        const raw = event.target.value
        if (!raw.trim()) {
          onValueChange(fallbackValue)
          return
        }

        const parsed = parsePriceInput(raw)
        if (parsed !== null) {
          onValueChange(parsed)
        }
      }}
      onPaste={(event) => {
        const pasted = event.clipboardData.getData('text')
        if (!pasted.trim()) return

        const parsed = parsePriceInput(pasted)
        if (parsed === null) return

        event.preventDefault()
        onValueChange(parsed)
      }}
    />
  )
}
