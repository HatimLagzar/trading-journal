'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Source_Serif_4 } from 'next/font/google'
import { usePremiumAccess } from '@/lib/usePremiumAccess'
import { useTheme } from '@/lib/ThemeContext'
import { createTradeThinkingQuote, getTradeThinkingQuotes } from '@/services/trade'
import {
  deleteStoredTradeAsset,
  getScreenshotUrl,
  uploadTradeThinkingQuoteImage,
} from '@/services/upload'
import type { Trade, TradeThinkingQuote } from '@/services/trade'
import type { System } from '@/services/system'

const thinkingFont = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

interface TradeDecisionsModalProps {
  trade: Trade
  systems: System[]
  userId: string
  onClose: () => void
}

export default function TradeDecisionsModal({
  trade,
  systems,
  userId,
  onClose,
}: TradeDecisionsModalProps) {
  const { isPremium, loading: premiumLoading, redirectToPremium } = usePremiumAccess()
  const { isDark } = useTheme()

  const [quotes, setQuotes] = useState<TradeThinkingQuote[]>([])
  const [quoteImageUrls, setQuoteImageUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingQuote, setSavingQuote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftQuote, setDraftQuote] = useState('')
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null)
  const [draftImagePreview, setDraftImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const isTradeOngoing = trade.avg_exit === null

  useEffect(() => {
    let isCancelled = false

    async function loadQuotes() {
      setLoading(true)
      setError(null)

      try {
        const quotesData = await getTradeThinkingQuotes(trade.id)
        if (!isCancelled) {
          setQuotes(quotesData)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load decisions')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadQuotes()

    return () => {
      isCancelled = true
    }
  }, [trade.id])

  useEffect(() => {
    let isCancelled = false

    async function loadQuoteImages() {
      const quotesWithImages = quotes.filter((quote) => quote.image_storage_path)
      if (quotesWithImages.length === 0) {
        setQuoteImageUrls({})
        return
      }

      try {
        const pairs = await Promise.all(
          quotesWithImages.map(async (quote) => {
            const signedUrl = await getScreenshotUrl(quote.image_storage_path as string)
            return [quote.id, signedUrl] as const
          }),
        )

        if (isCancelled) return
        setQuoteImageUrls(Object.fromEntries(pairs))
      } catch {
        if (!isCancelled) {
          setQuoteImageUrls({})
        }
      }
    }

    loadQuoteImages()

    return () => {
      isCancelled = true
    }
  }, [quotes])

  useEffect(() => {
    return () => {
      if (draftImagePreview) {
        URL.revokeObjectURL(draftImagePreview)
      }
    }
  }, [draftImagePreview])

  useEffect(() => {
    if (!isTradeOngoing) return

    function handlePaste(event: ClipboardEvent) {
      const imageFile = extractFirstImageFromClipboard(event)
      if (!imageFile) return

      event.preventDefault()

      if (!premiumLoading && !isPremium) {
        redirectToPremium('screenshots')
        return
      }

      setDraftImageFile(imageFile)
      setDraftImagePreview((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }

        return URL.createObjectURL(imageFile)
      })
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isTradeOngoing, isPremium, premiumLoading, redirectToPremium])

  const systemLabel = useMemo(() => {
    if (!trade.system_id) return '-'
    const system = systems.find((item) => item.id === trade.system_id)
    return system?.name || '-'
  }, [systems, trade.system_id])

  async function refreshQuotes() {
    const quotesData = await getTradeThinkingQuotes(trade.id)
    setQuotes(quotesData)
  }

  function resetQuoteDraft() {
    setDraftQuote('')
    if (draftImagePreview) {
      URL.revokeObjectURL(draftImagePreview)
    }
    setDraftImageFile(null)
    setDraftImagePreview(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function setDraftImage(file: File) {
    if (draftImagePreview) {
      URL.revokeObjectURL(draftImagePreview)
    }

    setDraftImageFile(file)
    setDraftImagePreview(URL.createObjectURL(file))
  }

  function handlePickImage(e: ChangeEvent<HTMLInputElement>) {
    const nextFile = e.target.files?.[0]
    if (!nextFile) return

    if (!premiumLoading && !isPremium) {
      redirectToPremium('screenshots')
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
      return
    }

    setDraftImage(nextFile)
  }

  async function handleAddQuote(e: FormEvent) {
    e.preventDefault()

    if (!isTradeOngoing) return

    const trimmedQuote = draftQuote.trim()
    if (!trimmedQuote && !draftImageFile) {
      setError('Add text or image to post a thought.')
      return
    }

    setSavingQuote(true)
    setError(null)

    let uploadedImage: { storagePath: string; originalFilename: string } | null = null

    try {
      if (draftImageFile) {
        if (!premiumLoading && !isPremium) {
          redirectToPremium('screenshots')
          return
        }

        uploadedImage = await uploadTradeThinkingQuoteImage(userId, trade.id, draftImageFile)
      }

      await createTradeThinkingQuote({
        trade_id: trade.id,
        user_id: userId,
        quote_text: trimmedQuote || null,
        image_storage_path: uploadedImage?.storagePath || null,
        image_filename: uploadedImage?.originalFilename || null,
      })

      await refreshQuotes()
      resetQuoteDraft()
    } catch (err) {
      if (uploadedImage) {
        try {
          await deleteStoredTradeAsset(uploadedImage.storagePath)
        } catch {
          // Ignore cleanup failures
        }
      }

      setError(err instanceof Error ? err.message : 'Failed to post your thought')
    } finally {
      setSavingQuote(false)
    }
  }

  const mutedTextClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const headingTextClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const cardBorderClass = isDark ? 'border-white/10' : 'border-slate-200'
  const cardBgClass = isDark ? 'bg-white/5' : 'bg-white'
  const quoteTextClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const composerBgClass = isDark ? 'bg-white/5' : 'bg-slate-50'
  const inputBgClass = isDark ? 'border-white/15 bg-[#0a1726] text-slate-100' : 'border-slate-300 bg-white text-slate-900'
  const buttonBorderClass = isDark ? 'border-white/15 text-slate-200 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
  const imageFrameClass = isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'

  return (
    <div className="flex max-h-[calc(90vh-0px)] flex-col">
      <div className={`border-b px-6 pb-4 pt-6 ${cardBorderClass}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={`text-xl font-semibold tracking-tight ${headingTextClass}`}>
              Decisions · #{trade.trade_number}
            </h2>
            <p className={`mt-1 text-sm ${mutedTextClass}`}>
              {trade.coin.toUpperCase()} · {trade.direction.toUpperCase()}
            </p>
            <p className={`mt-2 text-xs ${mutedTextClass}`}>
              System: {systemLabel} · Entry: {formatNumber(trade.avg_entry)} · Stop: {formatOptionalNumber(trade.stop_loss)} · Exit: {formatOptionalNumber(trade.avg_exit)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-2 py-1 text-lg leading-none ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}
            aria-label="Close decisions"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`text-sm font-semibold uppercase tracking-wide ${mutedTextClass}`}>Thinking Discussion</h3>
          <span className={`text-xs ${mutedTextClass}`}>Oldest → newest</span>
        </div>

        {error && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {loading && (
            <p className={`text-sm ${mutedTextClass}`}>Loading decisions...</p>
          )}

          {!loading && quotes.length === 0 && (
            <div className={`rounded-lg border border-dashed px-3 py-6 text-center text-sm ${isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
              No thoughts yet. Capture your first decision point.
            </div>
          )}

          {quotes.map((quote) => (
            <article key={quote.id} className={`rounded-xl border p-3 ${cardBorderClass} ${cardBgClass}`}>
              <p className={`mb-2 text-xs ${mutedTextClass}`}>{formatTimestamp(quote.created_at)}</p>
              {quote.quote_text && (
                <p className={`${thinkingFont.className} whitespace-pre-wrap text-[1.02rem] font-semibold leading-7 ${quoteTextClass}`}>
                  {quote.quote_text}
                </p>
              )}
              {quote.image_storage_path && quoteImageUrls[quote.id] && (
                <div className={`mt-3 rounded-lg border p-2 ${imageFrameClass}`}>
                  <img
                    src={quoteImageUrls[quote.id]}
                    alt={quote.image_filename || 'Quote attachment'}
                    className="max-h-72 w-full rounded object-cover"
                  />
                  {quote.image_filename && (
                    <p className={`mt-1 truncate text-xs ${mutedTextClass}`}>{quote.image_filename}</p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        {isTradeOngoing ? (
          <form onSubmit={handleAddQuote} className={`mt-4 space-y-3 rounded-xl border p-3 ${cardBorderClass} ${composerBgClass}`}>
            <textarea
              value={draftQuote}
              onChange={(e) => setDraftQuote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !savingQuote) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              rows={3}
              placeholder="What are you seeing right now? What matters most for your next decision?"
              className={`${thinkingFont.className} w-full resize-none rounded-lg border px-3 py-2 text-base font-semibold leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 ${inputBgClass}`}
            />

            {draftImagePreview && (
              <div className={`rounded-lg border p-2 ${inputBgClass}`}>
                <img src={draftImagePreview} alt="Quote attachment preview" className="h-36 w-full rounded object-cover" />
                <p className={`mt-1 truncate text-xs ${mutedTextClass}`}>{draftImageFile?.name}</p>
              </div>
            )}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handlePickImage}
              className="hidden"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!premiumLoading && !isPremium) {
                    redirectToPremium('screenshots')
                    return
                  }
                  imageInputRef.current?.click()
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${buttonBorderClass}`}
              >
                {!premiumLoading && !isPremium ? 'Attach image (Premium)' : 'Attach image'}
              </button>
              <button
                type="submit"
                disabled={savingQuote}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {savingQuote ? 'Posting...' : 'Post thought'}
              </button>
            </div>
            <p className={`text-xs ${mutedTextClass}`}>
              Tip: Cmd+Enter / Ctrl+Enter to post · paste an image with Cmd+V / Ctrl+V.
            </p>
          </form>
        ) : (
          <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            This trade is closed. Discussion is now read-only.
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = String(parsed.getFullYear()).slice(-2)
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString()
}

function formatOptionalNumber(value: number | null): string {
  if (value === null) return '-'
  return formatNumber(value)
}

function extractFirstImageFromClipboard(event: ClipboardEvent): File | null {
  const items = Array.from(event.clipboardData?.items || [])

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (!file) continue

    const extension = file.type.split('/')[1] || 'png'
    return new File([file], `focus-quote-${Date.now()}.${extension}`, {
      type: file.type,
    })
  }

  return null
}
