'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, InputHTMLAttributes } from 'react'
import {
  formatPriceInputValue,
  isPartialPriceInput,
  normalizePriceInputString,
  parsePriceInput,
} from '@/lib/parse-price-input'

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
    return <StringPriceInput {...props} />
  }

  return <NumericPriceInput {...props} />
}

function StringPriceInput({
  value,
  onValueChange,
  valueMode: _valueMode,
  onFocus,
  onBlur,
  ...rest
}: StringPriceInputProps) {
  const [draft, setDraft] = useState(value)
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value)
    }
  }, [value])

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text')
    if (!pasted.trim()) return

    const parsed = parsePriceInput(pasted)
    if (parsed === null) return

    event.preventDefault()
    const nextValue = String(parsed)
    setDraft(nextValue)
    onValueChange(nextValue)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={(event) => {
        isFocusedRef.current = true
        setDraft(value)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        isFocusedRef.current = false
        const nextValue = normalizePriceInputString(draft)
        setDraft(nextValue)
        onValueChange(nextValue)
        onBlur?.(event)
      }}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)

        if (!raw.trim()) {
          onValueChange('')
          return
        }

        if (isPartialPriceInput(raw)) return

        const parsed = parsePriceInput(raw)
        if (parsed !== null) {
          onValueChange(String(parsed))
        }
      }}
      onPaste={handlePaste}
    />
  )
}

function NumericPriceInput({
  value,
  onValueChange,
  fallbackValue = null,
  valueMode: _valueMode,
  onFocus,
  onBlur,
  ...rest
}: NumericPriceInputProps) {
  const [draft, setDraft] = useState(() => formatPriceInputValue(value))
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(formatPriceInputValue(value))
    }
  }, [value])

  function commitValue(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      onValueChange(fallbackValue)
      setDraft(formatPriceInputValue(fallbackValue))
      return
    }

    const parsed = parsePriceInput(trimmed)
    if (parsed !== null) {
      onValueChange(parsed)
      setDraft(String(parsed))
      return
    }

    setDraft(formatPriceInputValue(value))
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text')
    if (!pasted.trim()) return

    const parsed = parsePriceInput(pasted)
    if (parsed === null) return

    event.preventDefault()
    setDraft(String(parsed))
    onValueChange(parsed)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={(event) => {
        isFocusedRef.current = true
        setDraft(formatPriceInputValue(value))
        onFocus?.(event)
      }}
      onBlur={(event) => {
        isFocusedRef.current = false
        commitValue(draft)
        onBlur?.(event)
      }}
      onChange={(event) => {
        const raw = event.target.value
        setDraft(raw)

        if (!raw.trim()) {
          onValueChange(fallbackValue)
          return
        }

        if (isPartialPriceInput(raw)) return

        const parsed = parsePriceInput(raw)
        if (parsed !== null) {
          onValueChange(parsed)
        }
      }}
      onPaste={handlePaste}
    />
  )
}
